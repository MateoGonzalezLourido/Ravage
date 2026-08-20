/**
 * rutas_recursos.js — Resolución de rutas de recursos empaquetados
 *
 * En desarrollo el código corre desde el árbol del proyecto, así que los
 * recursos se resuelven relativos a este archivo.
 *
 * En producción el código JS vive dentro de `app.asar`, pero los directorios
 * declarados en `build.extraResources` (package.json) se copian FUERA del asar,
 * a `process.resourcesPath`. Resolverlos como `<...>/app.asar/env` da una ruta
 * que nunca existe.
 *
 * Módulo sin dependencias (sólo node:path / node:url) para poder usarse desde
 * cualquier punto del arranque, incluso antes de cargar libs.js.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** true si este módulo se está ejecutando desde dentro de un bundle asar */
export function dentroDeAsar() {
    return __dirname.includes('.asar');
}

/**
 * Resuelve un directorio declarado como `extraResources`.
 * @param {string} nombre nombre del directorio tal y como aparece en `extraResources.to`
 * @returns {string} ruta absoluta al directorio en el entorno actual
 */
export function resolverExtraResource(nombre) {
    return dentroDeAsar()
        ? path.join(process.resourcesPath, nombre)
        : path.resolve(__dirname, '../..', nombre);
}

/** Directorio que contiene los archivos `.env` originales (`env/`). */
export function resolverDirEnv() {
    return resolverExtraResource('env');
}
