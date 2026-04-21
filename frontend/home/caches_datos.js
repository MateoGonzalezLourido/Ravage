/**
 * @file caches_datos.js
 * @description Almacén central de datos cacheados para el frontend (RAM).
 * Centraliza información que debe estar disponible globalmente sin redundancia de IPC.
 */

// --- DATOS DEL USUARIO SESIÓN ---
export let ID_USUARIO_MONGO = null;
export let APODO_USUARIO = null;
export let CORREO_USUARIO = null;

export function establecer_id_usuario(id) {
    if (!id) return;
    ID_USUARIO_MONGO = id;
    console.log(`[Cache] ID de usuario establecido`);
}

export function establecer_apodo_usuario(apodo) {
    if (!apodo) return;
    APODO_USUARIO = apodo;
    console.log(`[Cache] Apodo de usuario establecido`);
}

export function establecer_correo_usuario(correo) {
    if (!correo) return;
    CORREO_USUARIO = correo;
    console.log(`[Cache] Correo de usuario establecido`);
}

// --- CACHÉ DE UI Y ESTADO TEMPORAL ---

/**
 * Cache para el buscador de chats en el panel lateral.
 * Evita recargas innecesarias si el texto no ha cambiado.
 */
export let cache_input_buscar_chat_ultimo = "";
export function establecer_cache_busqueda_chat(valor) {
    cache_input_buscar_chat_ultimo = valor;
}

/**
 * Caché para la lista de usuarios seleccionados al crear un nuevo chat o grupo.
 */
export let _cache_lista_usuarios_añadir = null;
export function establecer_cache_lista_usuarios_añadir(valor) {
    _cache_lista_usuarios_añadir = valor;
}

// --- CACHÉ DE DATOS DE NEGOCIO (CHATS/USUARIOS) ---

/**
 * Caché de usuarios del chat activo actualmente.
 * id -> { data, timestamp }
 */
export const CACHE_USUARIOS_ACTIVO = new Map();

/**
 * Caché de corta duración para peticiones repetitivas durante procesamiento por lotes (IPC).
 * Centralizado para evitar duplicidad de peticiones en un corto periodo de tiempo.
 */
export const batchRequestCache = {
    data: new Map(),

    async get(key, fetcher, ttl = 500) {
        const now = Date.now();
        const entry = this.data.get(key);

        if (!entry || entry.expiry < now) {
            this.data.set(key, { value: await fetcher(), expiry: now + ttl });
        }
        return this.data.get(key).value;
    }
};

/**
 * Almacena los archivos seleccionados para el próximo mensaje que se va a enviar.
 */
export let cache_archivos_adjuntos = [];
export function establecer_cache_archivos_adjuntos(archivos) {
    cache_archivos_adjuntos = archivos;
}
