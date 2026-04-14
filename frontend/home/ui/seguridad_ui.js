/**
 * Escapa caracteres especiales de HTML para prevenir ataques XSS.
 * @param {string} str - La cadena a escapar.
 * @returns {string} - La cadena escapada.
 */
export function escapeHTML(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, function(m) { return map[m]; });
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
