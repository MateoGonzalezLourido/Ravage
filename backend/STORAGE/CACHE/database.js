import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'cache.db');

// Asegurarse de que el directorio existe
if (!fs.existsSync(__dirname)) {
    fs.mkdirSync(__dirname, { recursive: true });
}

const db = new Database(DB_PATH);

// Configuración de rendimiento
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Crear tablas
db.exec(`
    CREATE TABLE IF NOT EXISTS archivos_descargados (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS historial_busquedas (
        datoUsadoBuscar TEXT PRIMARY KEY,
        _id TEXT NOT NULL,
        veces_buscado INTEGER DEFAULT 1,
        ultima_vez INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_archivos_timestamp ON archivos_descargados(timestamp);
    CREATE INDEX IF NOT EXISTS idx_historial_ultima_vez ON historial_busquedas(ultima_vez);
`);

export default db;
