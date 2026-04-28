import db from './database.js';
import { encontrar_usuario } from '../../repositories/UserRepository.js';
import { createLogger } from '../../utils/logger.js';
const log = createLogger('cache-hist-buscar');

const LIMITE_HISTORIAL = 200;
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const DIAS_2_MS = 2 * 24 * 60 * 60 * 1000;
const DIAS_90_MS = 90 * 24 * 60 * 60 * 1000;

// Preparar sentencias
const stmt_insert = db.prepare('INSERT OR REPLACE INTO historial_busquedas (datoUsadoBuscar, _id, veces_buscado, ultima_vez) VALUES (?, ?, ?, ?)');
const stmt_get_by_dato = db.prepare('SELECT * FROM historial_busquedas WHERE datoUsadoBuscar = ?');
const stmt_get_by_id = db.prepare('SELECT * FROM historial_busquedas WHERE _id = ?');
const stmt_delete_by_dato = db.prepare('DELETE FROM historial_busquedas WHERE datoUsadoBuscar = ?');
const stmt_delete_by_id = db.prepare('DELETE FROM historial_busquedas WHERE _id = ?');
const stmt_clear = db.prepare('DELETE FROM historial_busquedas');
const stmt_get_all = db.prepare('SELECT * FROM historial_busquedas ORDER BY ultima_vez DESC');
const stmt_count = db.prepare('SELECT COUNT(*) as count FROM historial_busquedas');
const stmt_get_candidates = db.prepare('SELECT * FROM historial_busquedas');

let _fecha_actualizado_global = Date.now();

async function _asegurar_inicio() {
    await _revisar_cache_semanal();
}

export function cancelar_limpieza_variable_cache() {
    // Ya no es necesario con SQLite directo
}

export async function revisar_mongodb_datos() {
    await _asegurar_inicio();
    let modificado = false;
    
    const items = stmt_get_all.all();
    for (const item of items) {
        const esCorreo = item.datoUsadoBuscar.includes('@');
        try {
            const valid = await encontrar_usuario(item.datoUsadoBuscar, esCorreo);
            if (!valid) {
                stmt_delete_by_dato.run(item.datoUsadoBuscar);
                modificado = true;
            }
        } catch(e) {
            log.error(e);
        }
    }
    
    if (modificado) {
        _fecha_actualizado_global = Date.now();
    }
}

async function _revisar_cache_semanal() {
    const ahora = Date.now();
    if (ahora - _fecha_actualizado_global > SEMANA_MS) {
        await revisar_mongodb_datos();
    }
}

function _borrar_inteligentemente() {
    const count = stmt_count.get().count;
    if (count <= LIMITE_HISTORIAL) return;
    
    const ahora = Date.now();
    const items = stmt_get_candidates.all();
    
    let mejorCandidato = null;
    let masViejo = null;

    for (const d of items) {
        const antiguedad = ahora - d.ultima_vez;
        
        if (!masViejo || d.ultima_vez < masViejo.ultima_vez) {
            masViejo = d;
        }

        if (antiguedad > DIAS_2_MS) {
            const esMuyViejo = antiguedad > DIAS_90_MS;
            
            if (!mejorCandidato) {
                mejorCandidato = { ...d, esMuyViejo };
                continue;
            }

            if (esMuyViejo && !mejorCandidato.esMuyViejo) {
                mejorCandidato = { ...d, esMuyViejo };
            } 
            else if (esMuyViejo === mejorCandidato.esMuyViejo) {
                if (d.veces_buscado < mejorCandidato.veces_buscado) {
                    mejorCandidato = { ...d, esMuyViejo };
                } 
                else if (d.veces_buscado === mejorCandidato.veces_buscado && d.ultima_vez < mejorCandidato.ultima_vez) {
                    mejorCandidato = { ...d, esMuyViejo };
                }
            }
        }
    }
    
    const itemABorrar = mejorCandidato || masViejo;
    if (itemABorrar) {
        stmt_delete_by_dato.run(itemABorrar.datoUsadoBuscar);
    }
}

export async function añadir_historial(id, datoUsado) {
    await _asegurar_inicio();
    
    let item = stmt_get_by_dato.get(datoUsado);
    if (!item) {
        item = stmt_get_by_id.get(id);
    }

    if (item) {
        stmt_insert.run(item.datoUsadoBuscar, item._id, item.veces_buscado + 1, Date.now());
    } else {
        stmt_insert.run(datoUsado, id, 1, Date.now());
        
        while (stmt_count.get().count > LIMITE_HISTORIAL) {
            _borrar_inteligentemente();
        }
    }
}

export async function borrar_historial_usuario(id_o_dato) {
    await _asegurar_inicio();
    
    const info = stmt_delete_by_dato.run(id_o_dato);
    if (info.changes > 0) return true;

    const infoId = stmt_delete_by_id.run(id_o_dato);
    return infoId.changes > 0;
}

export async function limpiar_historial_completo() {
    stmt_clear.run();
    _fecha_actualizado_global = Date.now();
}

export async function obtener_historial() {
    await _asegurar_inicio();
    const datos = stmt_get_all.all();
    return {
        datos: datos,
        fecha_actualizado_global: _fecha_actualizado_global,
        cantidad_guardados: datos.length
    };
}

export function limpiar_variable_cache() {
    // No aplica con SQLite
}
