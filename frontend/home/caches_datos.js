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

// --- CACHÉ DE VIRTUALIZACIÓN DE CHATS ---

const MAX_CHATS_CACHE_VIRTUALIZACION = 30;
const MAX_BLOQUES_PAGINACION_EXTRA = 5; // Bloques extra a guardar además de los mensajes iniciales (total 6)

/**
 * Caché de los primeros bloques de virtualización de chats.
 * Almacena los bloques recuperados para evitar consultas a BD al alternar rápidamente entre chats.
 */
export const CACHE_VIRTUALIZACION = new Map();

export function guardar_cache_virtualizacion(id_chat, mensajes_iniciales, hay_mas_inicial, cache_paginacion) {
    if (!id_chat) return;

    const paginacion_guardar = {};
    let bloques_guardados = 0;
    if (cache_paginacion) {
        const keys = Object.keys(cache_paginacion);
        for (let i = 0; i < Math.min(keys.length, MAX_BLOQUES_PAGINACION_EXTRA); i++) {
            paginacion_guardar[keys[i]] = cache_paginacion[keys[i]];
            bloques_guardados++;
        }
    }

    CACHE_VIRTUALIZACION.set(id_chat, {
        timestamp: Date.now(),
        mensajes_iniciales,
        hay_mas_inicial,
        cache_paginacion: paginacion_guardar
    });
    console.debug(`[Cache Virtualización] Guardado chat ${id_chat} en RAM. Mensajes iniciales: ${mensajes_iniciales?.length || 0}. Bloques extra: ${bloques_guardados}`);

    if (CACHE_VIRTUALIZACION.size > MAX_CHATS_CACHE_VIRTUALIZACION) {
        let key_mas_vieja = null;
        let tiempo_mas_viejo = Infinity;
        for (const [key, value] of CACHE_VIRTUALIZACION.entries()) {
            if (value.timestamp < tiempo_mas_viejo) {
                tiempo_mas_viejo = value.timestamp;
                key_mas_vieja = key;
            }
        }
        if (key_mas_vieja) {
            CACHE_VIRTUALIZACION.delete(key_mas_vieja);
            console.debug(`[Cache Virtualización] Límite de ${MAX_CHATS_CACHE_VIRTUALIZACION} alcanzado. Chat viejo ${key_mas_vieja} eliminado.`);
        }
    }
}

export function obtener_cache_virtualizacion(id_chat) {
    if (!id_chat) return null;
    const cache = CACHE_VIRTUALIZACION.get(id_chat);
    if (cache) {
        cache.timestamp = Date.now(); // Actualizar uso (LRU)
        console.debug(`[Cache Virtualización] Recuperado chat ${id_chat} de la RAM.`);
        return cache;
    }
    return null;
}

export function invalidar_cache_virtualizacion(id_chat) {
    if (!id_chat) return;
    if (CACHE_VIRTUALIZACION.has(id_chat)) {
        CACHE_VIRTUALIZACION.delete(id_chat);
        console.debug(`[Cache Virtualización] Chat ${id_chat} invalidado por nueva actualización.`);
    }
}

/**
 * Limpieza agresiva de cache para liberar RAM en segundo plano.
 * Deja solo los 3 chats más recientes y reduce a la mitad sus bloques.
 */
export function limpiar_cache_virtualizacion_segundo_plano() {
    console.log('[Cleanup RAM] Iniciando limpieza de cache de virtualización en el Frontend...');
    
    // 1. Dejar solo 3 chats en la cache (los más recientes)
    if (CACHE_VIRTUALIZACION.size > 3) {
        const entries = Array.from(CACHE_VIRTUALIZACION.entries());
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        
        const aMantener = entries.slice(0, 3);
        CACHE_VIRTUALIZACION.clear();
        for (const [key, value] of aMantener) {
            CACHE_VIRTUALIZACION.set(key, value);
        }
        console.debug(`[Cleanup RAM] Cache virtualización reducida a los 3 chats más recientes.`);
    }

    // 2. Liberar la mitad de los bloques de cada chat restante
    for (const [id, cache] of CACHE_VIRTUALIZACION.entries()) {
        if (cache.cache_paginacion) {
            const keys = Object.keys(cache.cache_paginacion);
            const total = keys.length;
            if (total > 0) {
                const aMantenerCount = Math.ceil(total / 2);
                const nuevaPaginacion = {};
                for (let i = 0; i < aMantenerCount; i++) {
                    nuevaPaginacion[keys[i]] = cache.cache_paginacion[keys[i]];
                }
                cache.cache_paginacion = nuevaPaginacion;
                console.debug(`[Cleanup RAM] Liberada mitad de bloques para chat ${id} (${total} -> ${aMantenerCount}).`);
            }
        }
    }
}


// --- CACHÉ DE ELEMENTOS DEL DOM (OPTIZACIÓN) ---

/**
 * Almacén central de referencias a elementos del DOM.
 * Evita el uso repetitivo de querySelector/getElementById en eventos de alta frecuencia.
 */
export const DOM_CACHE = {
    // Estáticos (No cambian durante la sesión)
    lista_chats_componentes: null,
    lista_contactos_componentes: null,
    btn_añadir_chat: null,
    chat_usuario: null,
    input_buscar_chat: null,
    info_chat_seccion: null,
    seccion_historial_archivos: null,
    
    // Ajustes
    menu_ajustes: null,
    menu_cambiar_datos_cuenta: null,
    lista_silenciados: null,
    lista_bloqueados: null,

    // Añadir Chats
    menu_añadir_chat: null,
    input_buscar_usuario_añadir: null,
    resultados_busqueda_usuarios: null,
    lista_contactos_añadir_grupo: null,
    btn_crear_chat_nuevo: null,
    input_nombre_chat_nuevo: null,

    // Historial
    lista_contenido_historial: null,
    btn_limpiar_historial: null,
    
    // Dinámicos (Cambian al abrir un chat diferente)
    cuerpo_mensajes_chat: null,
    textarea_mensaje_escritura: null,
    nav_principal_chat_usuario: null,

    /**
     * Inicializa las referencias a elementos que son permanentes en home.html
     */
    inicializar_estaticos() {
        // Básicos
        this.lista_chats_componentes = document.getElementById("lista-chats-componentes");
        this.lista_contactos_componentes = document.getElementById("lista-contactos-componentes");
        this.btn_añadir_chat = document.getElementById("bt-añadir-chat");
        this.chat_usuario = document.getElementById("chat-usuario");
        this.input_buscar_chat = document.getElementById("input-buscar-chat");
        this.info_chat_seccion = document.getElementById("info-chat-seccion");
        this.seccion_historial_archivos = document.getElementById("seccion-historial-archivos-alineador");

        // Ajustes
        this.menu_ajustes = document.getElementById("seccion-menu-cuenta-ajustes");
        this.menu_cambiar_datos_cuenta = document.getElementById("alineador-menu-cambiar-data-cuenta");
        this.lista_silenciados = document.getElementById("lista-usuarios-silenciados");
        this.lista_bloqueados = document.getElementById("lista-usuarios-bloqueados");

        // Añadir Chats
        this.menu_añadir_chat = document.getElementById("alineador-seccion-añadir-chat");
        this.input_buscar_usuario_añadir = document.getElementById("texto-buscar-chat-añadir");
        this.resultados_busqueda_usuarios = document.getElementById("resultados-busqueda-usuarios");
        this.lista_contactos_añadir_grupo = document.getElementById("contactos-añadidos-grupo");
        this.btn_crear_chat_nuevo = document.getElementById("bt-agregar-contacto-nuevo");
        this.input_nombre_chat_nuevo = document.getElementById("nombre-chat-nuevo-crear");

        // Historial
        this.lista_contenido_historial = document.getElementById("historial-lista-contenido");
        this.btn_limpiar_historial = document.getElementById("bt-limpiar-historial-completo");
    },

    /**
     * Actualiza las referencias a elementos que se recrean al abrir un chat.
     * Debe llamarse después de inyectar el HTML del chat en chat-usuario.
     */
    refrescar_elementos_chat() {
        this.cuerpo_mensajes_chat = document.getElementById("cuerpo-mensajes-chat");
        this.textarea_mensaje_escritura = document.getElementById("textarea-mensaje-escritura");
        this.nav_principal_chat_usuario = document.getElementById("nav-principal-chat-usuario");
    },

    /**
     * Libera todas las referencias al DOM para ahorrar RAM.
     */
    limpiar_cache_dom() {
        for (const key in this) {
            if (typeof this[key] !== "function") {
                this[key] = null;
            }
        }
        console.debug("[Cleanup RAM] Cache de elementos DOM liberada.");
    }
};
