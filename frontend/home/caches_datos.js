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
}

export function establecer_apodo_usuario(apodo) {
    APODO_USUARIO = apodo;
}

/**
 * Obtiene el apodo del usuario. Si no está en caché, lo solicita por IPC.
 */
export async function obtener_apodo_usuario() {
    if (APODO_USUARIO === null) {
        APODO_USUARIO = await window.cuenta_usuario.GET_APODO_SESION();
    }
    return APODO_USUARIO;
}

export function borrar_cache_apodo_usuario() {
    APODO_USUARIO = null;
}

export function establecer_correo_usuario(correo) {
    if (!correo) return;
    CORREO_USUARIO = correo;
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
    _data: new Map(),

    async get(key, fetcher, ttl = 500) {
        const now = Date.now();
        const entry = this._data.get(key);

        if (entry && entry.expiry > now) {
            return entry.value;
        }

        const value = await fetcher();
        this._data.set(key, { value, expiry: now + ttl });
        
        // Limpieza automática simple si crece mucho
        if (this._data.size > 100) {
            const keys = this._data.keys();
            for (let i = 0; i < 20; i++) {
                this._data.delete(keys.next().value);
            }
        }

        return value;
    },

    clear() {
        this._data.clear();
    }
};

/**
 * Almacena los archivos seleccionados para el próximo mensaje que se va a enviar.
 * Se usa un Map si se necesita búsqueda por nombre/id, pero para envío secuencial Array es suficiente.
 * Optamos por Map para evitar duplicados por ruta.
 */
export const cache_archivos_adjuntos = new Map();
export function establecer_cache_archivos_adjuntos(archivos) {
    cache_archivos_adjuntos.clear();
    if (Array.isArray(archivos)) {
        archivos.forEach(a => cache_archivos_adjuntos.set(a.path || a.name, a));
    }
}
export function obtener_archivos_adjuntos_lista() {
    return Array.from(cache_archivos_adjuntos.values());
}


// --- CACHÉ DE ELEMENTOS DEL DOM (OPTIZACIÓN) ---

/**
 * Almacén central de referencias a elementos del DOM.
 * Evita el uso repetitivo de querySelector/getElementById en eventos de alta frecuencia.
 */
export const DOM_CACHE = {
    // Estáticos (No cambian durante la sesión)
    lista_chats_componentes: null,
    chat_usuario: null,
    input_buscar_chat: null,
    info_chat_seccion: null,
    seccion_historial_archivos: null,
    
    // Dinámicos (Cambian al abrir un chat diferente)
    cuerpo_mensajes_chat: null,
    textarea_mensaje_escritura: null,
    nav_principal_chat_usuario: null,

    /**
     * Inicializa las referencias a elementos que son permanentes en home.html
     */
    inicializar_estaticos() {
        this.lista_chats_componentes = document.getElementById("lista-chats-componentes");
        this.chat_usuario = document.getElementById("chat-usuario");
        this.input_buscar_chat = document.getElementById("input-buscar-chat");
        this.info_chat_seccion = document.getElementById("info-chat-seccion");
        this.seccion_historial_archivos = document.getElementById("seccion-historial-archivos-alineador");
    },

    /**
     * Actualiza las referencias a elementos que se recrean al abrir un chat.
     * Debe llamarse después de inyectar el HTML del chat en chat-usuario.
     */
    refrescar_elementos_chat() {
        this.cuerpo_mensajes_chat = document.getElementById("cuerpo-mensajes-chat");
        this.textarea_mensaje_escritura = document.getElementById("textarea-mensaje-escritura");
        this.nav_principal_chat_usuario = document.getElementById("nav-principal-chat-usuario");
    }
};
