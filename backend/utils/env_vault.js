/**
 * env_vault.js — Baúl seguro para variables de entorno
 *
 * Flujo:
 *   1. Al arrancar (después de app.whenReady): detecta .env en env/
 *      → los cifra con safeStorage y los borra del disco
 *   2. Carga las variables desde el baúl cifrado a process.env
 *
 * Almacenamiento: <userData>/env_vault/<nombre>.enc  (Buffer cifrado por el SO)
 * Backend safeStorage: libsecret (Linux) · DPAPI (Windows) · Keychain (macOS)
 */

import fs from 'node:fs';
import path from 'node:path';
import { app, safeStorage } from './libs.js';
import { resolverDirEnv } from './rutas_recursos.js';

// Directorio donde se espera encontrar los .env originales.
// En desarrollo es <proyecto>/env; en producción el código corre dentro de
// app.asar y env/ se copia a process.resourcesPath vía extraResources, así que
// la resolución la centraliza rutas_recursos.js (mismo criterio que libs.js).
function getEnvSrcDir() {
    return resolverDirEnv();
}

function getVaultDir() {
    return path.join(app.getPath('userData'), 'env_vault');
}

// Parsea contenido de un .env en un objeto {CLAVE: valor}
function parseEnvContent(content) {
    const vars = {};
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const sep = trimmed.indexOf('=');
        if (sep === -1) continue;
        const key = trimmed.slice(0, sep).trim();
        const value = trimmed.slice(sep + 1).trim();
        if (key) vars[key] = value;
    }
    return vars;
}

// Devuelve los .env encontrados en env/
function listarEnvSrc() {
    const dirEnv = getEnvSrcDir();
    if (!fs.existsSync(dirEnv)) return [];
    return fs.readdirSync(dirEnv)
        .filter(f => f.startsWith('.env') && !f.endsWith('.example'))
        .map(f => ({ nombre: f, ruta: path.join(dirEnv, f) }));
}

// Devuelve los .enc del baúl
function listarVault() {
    const dir = getVaultDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.enc'))
        .map(f => ({ nombre: f.slice(0, -4), ruta: path.join(dir, f) }));
}

/**
 * Lee los .env de env/, los cifra con safeStorage y borra los originales.
 * No hace nada si no hay archivos o safeStorage no está disponible.
 * @returns {boolean} true si migró al menos un archivo
 */
function migrarEnvAlBaul() {
    const archivos = listarEnvSrc().filter(({ ruta }) => {
        try { return fs.statSync(ruta).size > 0; } catch { return false; }
    });
    if (archivos.length === 0) return false;

    if (!safeStorage.isEncryptionAvailable()) {
        console.warn('[EnvVault] safeStorage no disponible — los .env permanecen en disco sin cifrar. Instala gnome-keyring o kwallet para protegerlos.');
        return false;
    }

    const vaultDir = getVaultDir();
    fs.mkdirSync(vaultDir, { recursive: true });

    let migrados = 0;
    for (const { nombre, ruta } of archivos) {
        try {
            const contenido = fs.readFileSync(ruta, 'utf-8');
            const cifrado = safeStorage.encryptString(contenido);
            const destino = path.join(vaultDir, nombre + '.enc');
            fs.writeFileSync(destino, cifrado);
            // Solo borra el original si el .enc se escribió correctamente
            fs.accessSync(destino, fs.constants.R_OK);
            fs.unlinkSync(ruta);
            migrados++;
            console.log(`[EnvVault] Migrado y eliminado del disco: ${nombre}`);
        } catch (err) {
            const soloLectura = ['EACCES', 'EPERM', 'EROFS'].includes(err.code);
            console.error(
                `[EnvVault] Fallo migrando ${nombre} — el archivo original SIGUE EN CLARO en ${ruta}:`,
                err.message,
                soloLectura ? '(directorio de instalación sin permiso de escritura)' : ''
            );
        }
    }

    return migrados > 0;
}

/**
 * Descifra los archivos del baúl e inyecta sus variables en process.env.
 * El baúl tiene prioridad sobre lo que dotenv haya cargado previamente.
 * @returns {boolean} true si cargó al menos un archivo
 */
function cargarDesdeVaul() {
    const archivos = listarVault();
    if (archivos.length === 0) return false;

    if (!safeStorage.isEncryptionAvailable()) {
        console.warn('[EnvVault] safeStorage no disponible — no se pueden leer los .enc del baúl.');
        return false;
    }

    let cargados = 0;
    for (const { nombre, ruta } of archivos) {
        try {
            const cifrado = fs.readFileSync(ruta);
            const contenido = safeStorage.decryptString(cifrado);
            const vars = parseEnvContent(contenido);
            for (const [key, value] of Object.entries(vars)) {
                process.env[key] = value;
            }
            cargados++;
            console.log(`[EnvVault] Cargado desde baúl: ${nombre}`);
        } catch (err) {
            console.error(`[EnvVault] Error descifrando ${nombre}:`, err.message);
        }
    }

    return cargados > 0;
}

/**
 * Punto de entrada principal. Llamar una vez dentro de app.whenReady().
 * Migra si hay .env en disco, luego carga desde el baúl.
 */
export async function inicializarVault() {
    console.log(`[EnvVault] Buscando .env en: ${getEnvSrcDir()}`);
    migrarEnvAlBaul();
    cargarDesdeVaul();
}
