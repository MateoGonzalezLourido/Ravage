import { generateKeyPairSync, publicEncrypt, privateDecrypt, createCipheriv, createDecipheriv, randomBytes, diffieHellman } from 'crypto';

/**
 * Servicio de Criptografía para E2EE
 * Utiliza X25519 para intercambio de llaves y AES-256-GCM para contenido.
 */

// Generar par de llaves de identidad (X25519)
export function generarLlavesIdentidad() {
    const { publicKey, privateKey } = generateKeyPairSync('x25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { publicKey, privateKey };
}

// Cifrar datos con una llave simétrica (AES-256-GCM)
export function cifrarContenido(contenido, key) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
        cipher.update(typeof contenido === 'string' ? contenido : JSON.stringify(contenido), 'utf8'),
        cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
        data: encrypted.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
    };
}

// Descifrar datos con una llave simétrica (AES-256-GCM)
export function descifrarContenido(cifrado, key) {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(cifrado.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(cifrado.tag, 'hex'));
    
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(cifrado.data, 'hex')),
        decipher.final()
    ]);
    
    return decrypted.toString('utf8');
}

// Derivar un secreto compartido entre una llave privada propia y una pública ajena (ECDH)
// Nota: Para simplificar la distribución de la ChatKey, usaremos cifrado asimétrico directo 
// sobre la ChatKey inicial, o ECDH para derivarla.
// Implementaremos RSA para la envoltura de la ChatKey por simplicidad en la lógica de distribución.

export function generarLlavesRSA() {
    return generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
}

export function cifrarConPublica(datos, publicKey) {
    return publicEncrypt(publicKey, Buffer.from(datos)).toString('hex');
}

export function descifrarConPrivada(datosHex, privateKey) {
    return privateDecrypt(privateKey, Buffer.from(datosHex, 'hex')).toString('utf8');
}
