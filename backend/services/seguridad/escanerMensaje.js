/*AQUI SE IMPLEMENTAN TODAS LAS PROTECCIONES PARA LOS MENSAJES
Este actua en el frontend revisando los mensajes antes de ser enviados y cuando se renderizan
avisando al usuario de que puede ser inseguro copiar ese mensaje

En el backend lo que hace es bloquear mandar el mensaje si detecta algo peligroso
*/

//Detectar escenografia
const hiddenCharsRegex = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uE0000-\uE007F]/g;
function detectSteganography(text) {
    return hiddenCharsRegex.test(text);
}
//eliminar caracteres peligrosos
function removeSteganography(text) {
    // Regex que agrupa todos los caracteres invisibles y problemáticos
    const nuevo = text.replace(hiddenCharsRegex, '')
    return { texto: nuevo, cambios: nuevo.length !== text.length }
}

//detectar enlaces
const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
function detectUrl(text) {
    return urlRegex.test(text);
}
//eliminar enlaces
function removeUrl(text) {
    return text.replace(urlRegex, '');
}

//detectar codigo (malicioso o no)
function detectarCodigo(text) {

}

export {
    detectSteganography,
    removeSteganography,
    detectUrl,
    removeUrl
}