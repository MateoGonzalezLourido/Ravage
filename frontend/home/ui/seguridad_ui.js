const MAPA_ESCAPE_HTML = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;'
};

/**
 * Escapa caracteres especiales de HTML para prevenir ataques XSS.
 * Única implementación de la app (antes había una copia local en chat.js).
 * Castea el valor con String() para no romper si llega un número/objeto, y
 * escapa también la comilla invertida (`) porque algunos navegadores la
 * aceptan como delimitador de atributo sin comillas.
 * @param {*} str - El valor a escapar (se convierte a cadena).
 * @returns {string} - La cadena escapada ('' si es null/undefined).
 */
export function escapeHTML(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"'`]/g, (c) => MAPA_ESCAPE_HTML[c]);
}

/**
 * Normaliza un selector de ID para evitar inyecciones de selectores.
 * @param {string} id - El ID a normalizar.
 * @returns {string} - El selector de atributo seguro.
 */
export function safeIdSelector(id) {
    // Si el ID contiene comillas, las escapamos para el selector de atributos
    const escapedId = id.replace(/"/g, '\\"');
    return `[data-id="${escapedId}"]`;
}
