import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

const ruta_base = app ? app.getPath('userData') : path.join(process.cwd(), '.test_data');
const DB_PATH = path.join(ruta_base, 'cache.db');

// Asegurarse de que el directorio existe
if (!fs.existsSync(ruta_base)) {
    fs.mkdirSync(ruta_base, { recursive: true });
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
