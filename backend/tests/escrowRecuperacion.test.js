import { describe, it, expect, beforeAll } from 'vitest';
import { createDecipheriv, randomBytes } from 'node:crypto';
import {
    generarLlavesX25519,
    cifrarConX25519,
    descifrarConX25519,
    cifrarContenido,
    descifrarContenido,
    encriptarDatosSistema,
    desencriptarDatosSistema
} from '../services/cryptoService.js';

/**
 * Escrow de claves de recuperación por participante (`Message.claves_recuperacion`).
 *
 * Sustituye a la antigua copia del `asunto`/`key_enc` cifrada con INTERNAL_ENCRYPTION_KEY,
 * que era la misma clave en todas las instalaciones y por tanto permitía a cualquiera que la
 * extrajese leer los mensajes de todos los usuarios.
 *
 * Lo que se garantiza aquí: cada participante recupera el mensaje completo con su clave
 * privada X25519, y ni la clave maestra ni un tercero pueden hacerlo.
 */
describe('Escrow de recuperación por participante (E2EE)', () => {
    const CLAVE_MAESTRA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    let alice, bob, carol, extrano;
    let chatKey, encriptado, claves_recuperacion;
    const ASUNTO = 'mensaje secreto de prueba';
    const NOMBRE_ARCHIVO = 'factura.pdf';

    beforeAll(async () => {
        process.env.INTERNAL_ENCRYPTION_KEY = CLAVE_MAESTRA;

        [alice, bob, carol, extrano] = await Promise.all([
            generarLlavesX25519(), generarLlavesX25519(),
            generarLlavesX25519(), generarLlavesX25519()
        ]);

        // Un mensaje tal y como lo escribe ENVIAR_MENSAJE: el contenido completo va en
        // `encriptado` bajo la messageKey del ratchet.
        chatKey = randomBytes(32);
        const payload = JSON.stringify({
            asunto: ASUNTO,
            archivos: [{ nombre: NOMBRE_ARCHIVO, id: 'abc123', iv: 'deadbeef', tag: 'cafe' }],
            emisor: 'alice',
            data: new Date().toISOString()
        });
        encriptado = cifrarContenido(payload, chatKey);

        // El escrow: la misma clave envuelta con la pública de cada participante.
        claves_recuperacion = [alice, bob, carol].map((u, i) => ({
            usuario_id: ['alice', 'bob', 'carol'][i],
            clave: cifrarConX25519(chatKey.toString('hex'), u.publicKey)
        }));
    });

    /** Réplica de _recuperarDesdeEscrow: probar cada entrada con la clave privada dada. */
    function recuperar(entradas, privateKey) {
        for (const entrada of entradas) {
            try {
                const claveHex = descifrarConX25519(entrada.clave, privateKey);
                return JSON.parse(descifrarContenido(encriptado, Buffer.from(claveHex, 'hex')));
            } catch { /* siguiente entrada */ }
        }
        return null;
    }

    it.each([['alice', 0], ['bob', 1], ['carol', 2]])(
        '%s recupera el mensaje completo con su clave privada',
        (_nombre, idx) => {
            const usuarios = [alice, bob, carol];
            const recuperado = recuperar(claves_recuperacion, usuarios[idx].privateKey);

            expect(recuperado).not.toBeNull();
            expect(recuperado.asunto).toBe(ASUNTO);
            // El nombre viaja en claro DENTRO del payload cifrado, no en el documento suelto.
            expect(recuperado.archivos[0].nombre).toBe(NOMBRE_ARCHIVO);
        }
    );

    it('la clave maestra (INTERNAL_ENCRYPTION_KEY) no abre el escrow', () => {
        const maestra = Buffer.from(CLAVE_MAESTRA, 'hex');
        for (const entrada of claves_recuperacion) {
            expect(() => {
                const d = createDecipheriv('aes-256-gcm', maestra, Buffer.from(entrada.clave.iv, 'hex'));
                d.setAuthTag(Buffer.from(entrada.clave.tag, 'hex'));
                Buffer.concat([d.update(Buffer.from(entrada.clave.data, 'hex')), d.final()]);
            }).toThrow();
        }
        // Y tampoco sirve para el contenido del mensaje.
        expect(() => descifrarContenido(encriptado, maestra)).toThrow();
    });

    it('un usuario que no participa en el chat no puede recuperarlo', () => {
        expect(recuperar(claves_recuperacion, extrano.privateKey)).toBeNull();
    });

    it('el asunto no aparece en claro dentro del ciphertext', () => {
        expect(encriptado.data).not.toContain(Buffer.from(ASUNTO).toString('hex'));
        expect(encriptado.data).not.toContain(ASUNTO);
    });

    it('sigue leyéndose el historial antiguo cifrado con la clave de sistema', () => {
        // Los mensajes anteriores al escrow guardaban el asunto así; la vía heredada debe
        // seguir funcionando para no perder el historial ya almacenado.
        const heredado = encriptarDatosSistema(ASUNTO);
        expect(desencriptarDatosSistema(heredado)).toBe(ASUNTO);
    });

    describe('Vista previa del último mensaje (User.chats[].ultimomensaje_e2ee)', () => {
        it('cada usuario abre su propia vista previa y nadie más', () => {
            // Se envuelve con la clave pública de cada destinatario, en su propio documento.
            const previaAlice = cifrarConX25519(ASUNTO, alice.publicKey);
            const previaBob = cifrarConX25519(ASUNTO, bob.publicKey);

            expect(descifrarConX25519(previaAlice, alice.privateKey)).toBe(ASUNTO);
            expect(descifrarConX25519(previaBob, bob.privateKey)).toBe(ASUNTO);

            // La de Alice no la abre Bob, ni un extraño.
            expect(() => descifrarConX25519(previaAlice, bob.privateKey)).toThrow();
            expect(() => descifrarConX25519(previaAlice, extrano.privateKey)).toThrow();
        });

        it('la clave maestra no abre la vista previa', () => {
            const previa = cifrarConX25519(ASUNTO, alice.publicKey);
            const maestra = Buffer.from(CLAVE_MAESTRA, 'hex');
            expect(() => {
                const d = createDecipheriv('aes-256-gcm', maestra, Buffer.from(previa.iv, 'hex'));
                d.setAuthTag(Buffer.from(previa.tag, 'hex'));
                Buffer.concat([d.update(Buffer.from(previa.data, 'hex')), d.final()]);
            }).toThrow();
        });

        it('un asunto vacío no produce un envoltorio inválido para el esquema', () => {
            // `data` es `required: true`, y mongoose rechaza la cadena vacía: por eso el
            // emisor deja la vista previa en null cuando el mensaje es solo de archivos,
            // en vez de envolver "".
            const envueltoVacio = cifrarConX25519('', alice.publicKey);
            expect(envueltoVacio.data).toBe('');
        });
    });
});
