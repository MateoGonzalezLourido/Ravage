/**
 * env_vault.js — Baúl seguro para variables de entorno
 *
 * Flujo:
 *   1. Al arrancar (después de app.whenReady): detecta .env en env/
 *      → los cifra con safeStorage y los borra del disco
 *   2. Carga las variables desde el baúl cifrado a process.env
 *   3. Expone exportarEnvADescargas() para regenerar los .env en Descargas
 *
 * Almacenamiento: <userData>/env_vault/<nombre>.enc  (Buffer cifrado por el SO)
 * Backend safeStorage: libsecret (Linux) · DPAPI (Windows) · Keychain (macOS)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, safeStorage } from './libs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorio del proyecto donde se espera encontrar los .env originales
const ENV_SRC_DIR = path.resolve(__dirname, '../../env');

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
    if (!fs.existsSync(ENV_SRC_DIR)) return [];
    return fs.readdirSync(ENV_SRC_DIR)
        .filter(f => f.startsWith('.env') && !f.endsWith('.example'))
        .map(f => ({ nombre: f, ruta: path.join(ENV_SRC_DIR, f) }));
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
    const archivos = listarEnvSrc();
    if (archivos.length === 0) return false;

    if (!safeStorage.isEncryptionAvailable()) {
        console.warn('[EnvVault] safeStorage no disponible en este sistema, manteniendo .env en disco');
        return false;
    }

    const vaultDir = getVaultDir();
    fs.mkdirSync(vaultDir, { recursive: true });

    for (const { nombre, ruta } of archivos) {
        try {
            const contenido = fs.readFileSync(ruta, 'utf-8');
            const cifrado = safeStorage.encryptString(contenido);
            fs.writeFileSync(path.join(vaultDir, nombre + '.enc'), cifrado);
            fs.unlinkSync(ruta);
            console.log(`[EnvVault] Migrado al baúl y eliminado: ${nombre}`);
        } catch (err) {
            console.error(`[EnvVault] Error migrando ${nombre}:`, err.message);
        }
    }

    return true;
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
        console.warn('[EnvVault] safeStorage no disponible, no se pueden descifrar las variables');
        return false;
    }

    for (const { nombre, ruta } of archivos) {
        try {
            const cifrado = fs.readFileSync(ruta);
            const contenido = safeStorage.decryptString(cifrado);
            const vars = parseEnvContent(contenido);
            for (const [key, value] of Object.entries(vars)) {
                process.env[key] = value;
            }
            console.log(`[EnvVault] Cargado desde baúl: ${nombre}`);
        } catch (err) {
            console.error(`[EnvVault] Error descifrando ${nombre}:`, err.message);
        }
    }

    return true;
}

/**
 * Punto de entrada principal. Llamar una vez dentro de app.whenReady().
 * Migra si hay .env en disco, luego carga desde el baúl.
 */
export async function inicializarVault() {
    migrarEnvAlBaul();
    cargarDesdeVaul();
}

/**
 * Descifra todos los archivos del baúl y los escribe en <Descargas>/Ravage-env/.
 * @returns {{ ok: boolean, ruta?: string, error?: string }}
 */
export function exportarEnvADescargas() {
    const archivos = listarVault();
    if (archivos.length === 0) return { ok: false, error: 'El baúl está vacío' };

    if (!safeStorage.isEncryptionAvailable()) {
        return { ok: false, error: 'safeStorage no disponible en este sistema' };
    }

    const destino = path.join(app.getPath('downloads'), 'Ravage-env');

    try {
        fs.mkdirSync(destino, { recursive: true });

        for (const { nombre, ruta } of archivos) {
            const cifrado = fs.readFileSync(ruta);
            const contenido = safeStorage.decryptString(cifrado);
            fs.writeFileSync(path.join(destino, nombre), contenido, { encoding: 'utf-8', mode: 0o600 });
        }

        console.log(`[EnvVault] Archivos exportados a: ${destino}`);
        return { ok: true, ruta: destino };
    } catch (err) {
        console.error('[EnvVault] Error exportando:', err.message);
        return { ok: false, error: err.message };
    }
}
