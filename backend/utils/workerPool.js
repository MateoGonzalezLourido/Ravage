import { createLogger } from './logger.js';
const log = createLogger('worker-pool');
import { Worker } from 'node:worker_threads';
import { os, path } from './libs.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// WORKER POOL MULTI-CORE
// ==========================================

/**
 * Calcula el número de workers a usar basándose en la configuración y CPUs reales.
 * @returns {number}
 */
function calcularNumeroWorkers() {
    const cpusReales = os.cpus().length;
    const envVal = process.env.MAX_CPU_CORES_PARALEL;

    // Si no está definido o es "none" → devolvemos dinámico
    if (!envVal || envVal.toLowerCase() === 'none') {
        const resultado = Math.max(2, cpusReales - 1);
        log.info(`Workers (auto): ${resultado} de ${cpusReales} CPUs`);
        return resultado;
    }

    // Si es un número, validar contra CPUs reales
    const pedido = parseInt(envVal, 10);
    if (isNaN(pedido) || pedido < 1) {
        log.warn(`MAX_CPU_CORES_PARALEL inválido ("${envVal}"), usando modo automático`);
        return Math.max(2, cpusReales - 1);
    }

    if (pedido <= cpusReales) {
        log.info(`Workers (manual): ${pedido} de ${cpusReales} CPUs`);
        return pedido;
    }

    // Pidió más de los que hay → usar máximo -1
    const fallback = Math.max(1, cpusReales - 1);
    log.warn(`MAX_CPU_CORES_PARALEL=${pedido} excede CPUs reales (${cpusReales}), usando ${fallback}`);
    return fallback;
}

/** @type {WorkerPool | null} */
let instanciaPool = null;

class WorkerPool {
    /**
     * @param {string} workerPath - Ruta absoluta al archivo del worker
     * @param {number} numWorkers - Cantidad de worker threads
     * @param {object} [opciones]
     * @param {number} [opciones.timeoutMs=30000] - Timeout por tarea
     * @param {number} [opciones.maxCola=500] - Máximo de tareas en cola
     */
    constructor(workerPath, numWorkers, opciones = {}) {
        this.workerPath = workerPath;
        this.numWorkers = numWorkers;
        this.timeoutMs = opciones.timeoutMs || 30000;
        this.maxCola = opciones.maxCola || 500;

        /** @type {Worker[]} */
        this.workers = [];
        /** @type {boolean[]} - true = disponible */
        this.disponibles = [];
        /** @type {Array<{tarea: object, resolve: Function, reject: Function}>} */
        this.cola = [];
        /** @type {Map<number, {resolve: Function, reject: Function, timer: NodeJS.Timeout}>} */
        this.pendientes = new Map();

        this._idCounter = 0;
        this._terminado = false;
        this._inicializado = false;
    }

    /**
     * Inicializa el pool lazily (se llama automáticamente en la primera tarea).
     */
    _inicializar() {
        if (this._inicializado) return;
        this._inicializado = true;

        for (let i = 0; i < this.numWorkers; i++) {
            this._crearWorker(i);
        }

        log.info(`Worker Pool inicializado: ${this.numWorkers} workers con "${path.basename(this.workerPath)}"`);
    }

    /**
     * Crea o recrea un worker en el índice dado.
     * @param {number} indice
     */
    _crearWorker(indice) {
        const worker = new Worker(this.workerPath);
        this.workers[indice] = worker;
        this.disponibles[indice] = true;

        worker.on('message', (msg) => {
            this._manejarRespuesta(indice, msg);
        });

        worker.on('error', (err) => {
            log.error({ err, workerIndex: indice }, 'Worker error, reiniciando...');
            this._rechazarPendientesWorker(indice, err);
            this._reemplazarWorker(indice);
        });

        worker.on('exit', (code) => {
            if (code !== 0 && !this._terminado) {
                log.warn({ workerIndex: indice, code }, 'Worker salió inesperadamente, reiniciando...');
                this._rechazarPendientesWorker(indice, new Error(`Worker exit code ${code}`));
                this._reemplazarWorker(indice);
            }
        });
    }

    /**
     * Reemplaza un worker caído.
     * @param {number} indice
     */
    _reemplazarWorker(indice) {
        if (this._terminado) return;
        try {
            this._crearWorker(indice);
            this._procesarCola();
        } catch (err) {
            log.error({ err, workerIndex: indice }, 'Fallo al reiniciar worker');
        }
    }

    /**
     * Rechaza todas las tareas pendientes de un worker específico.
     * @param {number} indice
     * @param {Error} error
     */
    _rechazarPendientesWorker(indice, error) {
        for (const [id, pendiente] of this.pendientes) {
            if (pendiente.workerIndex === indice) {
                clearTimeout(pendiente.timer);
                pendiente.reject(error);
                this.pendientes.delete(id);
            }
        }
    }

    /**
     * Maneja la respuesta de un worker.
     * @param {number} indice
     * @param {object} msg - { id, resultado?, error? }
     */
    _manejarRespuesta(indice, msg) {
        const pendiente = this.pendientes.get(msg.id);
        if (!pendiente) return;

        clearTimeout(pendiente.timer);
        this.pendientes.delete(msg.id);

        if (msg.error) {
            pendiente.reject(new Error(msg.error));
        } else {
            pendiente.resolve(msg.resultado);
        }

        // Worker vuelve a estar disponible
        this.disponibles[indice] = true;
        this._procesarCola();
    }

    /**
     * Intenta despachar tareas de la cola a workers disponibles.
     */
    _procesarCola() {
        while (this.cola.length > 0) {
            const idxLibre = this.disponibles.indexOf(true);
            if (idxLibre === -1) break; // No hay workers libres

            const { tarea, resolve, reject } = this.cola.shift();
            this._enviarAlWorker(idxLibre, tarea, resolve, reject);
        }
    }

    /**
     * Envía una tarea a un worker específico.
     */
    _enviarAlWorker(indice, tarea, resolve, reject) {
        const id = ++this._idCounter;
        this.disponibles[indice] = false;

        const timer = setTimeout(() => {
            this.pendientes.delete(id);
            this.disponibles[indice] = true;
            reject(new Error(`Worker timeout (${this.timeoutMs}ms) en tarea "${tarea.tipo}"`));
            this._procesarCola();
        }, this.timeoutMs);

        this.pendientes.set(id, { resolve, reject, timer, workerIndex: indice });

        try {
            // Nota: Confiamos en el "Structured Clone Algorithm" nativo de postMessage.
            // Es mucho más rápido y maneja circularidades (en Node 18+) mejor que una función recursiva.
            // Solo debemos asegurar que tarea.datos no contenga funciones ni proxies complejos.
            this.workers[indice].postMessage({ id, tipo: tarea.tipo, datos: tarea.datos });
        } catch (err) {
            clearTimeout(timer);
            this.pendientes.delete(id);
            this.disponibles[indice] = true;
            log.error({ err, tipo: tarea.tipo }, "Error de serialización IPC");
            reject(new Error(`Error al serializar datos para el worker: ${err.message}`));
            this._procesarCola();
        }
    }

    /**
     * Ejecuta una tarea en un worker del pool.
     * @param {string} tipo - Tipo de operación (ej: 'GENERAR_LLAVES_RSA')
     * @param {object} datos - Datos para la operación
     * @returns {Promise<any>}
     */
    ejecutar(tipo, datos = {}) {
        if (this._terminado) return Promise.reject(new Error('Pool terminado'));
        this._inicializar();

        return new Promise((resolve, reject) => {
            const tarea = { tipo, datos };

            // Buscar worker libre
            const idxLibre = this.disponibles.indexOf(true);
            if (idxLibre !== -1) {
                this._enviarAlWorker(idxLibre, tarea, resolve, reject);
            } else {
                // Encolar
                if (this.cola.length >= this.maxCola) {
                    reject(new Error(`Cola del pool llena (${this.maxCola} tareas)`));
                    return;
                }
                this.cola.push({ tarea, resolve, reject });
            }
        });
    }

    /**
     * Ejecuta una tarea batch dividida entre todos los workers.
     * Divide el array de items equitativamente entre workers disponibles.
     * @param {string} tipo - Tipo de operación
     * @param {Array} items - Array de elementos a procesar
     * @param {object} datosComunes - Datos compartidos entre todos los chunks
     * @returns {Promise<Array>} - Resultado combinado en orden original
     */
    async ejecutarBatch(tipo, items, datosComunes = {}) {
        if (this._terminado) throw new Error('Pool terminado');
        if (!items || items.length === 0) return [];
        this._inicializar();

        // Dividir items entre los workers disponibles
        const numChunks = Math.min(this.numWorkers, items.length);
        const chunks = [];
        const chunkSize = Math.ceil(items.length / numChunks);

        for (let i = 0; i < numChunks; i++) {
            const inicio = i * chunkSize;
            const fin = Math.min(inicio + chunkSize, items.length);
            if (inicio < items.length) {
                chunks.push({
                    items: items.slice(inicio, fin),
                    indiceInicio: inicio
                });
            }
        }

        // Ejecutar todos los chunks en paralelo
        const resultados = await Promise.all(
            chunks.map(chunk =>
                this.ejecutar(tipo, {
                    ...datosComunes,
                    items: chunk.items,
                    indiceInicio: chunk.indiceInicio
                })
            )
        );

        // Combinar resultados en orden original
        const resultado = new Array(items.length);
        for (const chunk of resultados) {
            if (Array.isArray(chunk.items)) {
                for (let i = 0; i < chunk.items.length; i++) {
                    resultado[chunk.indiceInicio + i] = chunk.items[i];
                }
            }
        }

        return resultado;
    }

    /**
     * Termina todos los workers y limpia el pool.
     */
    async terminar() {
        this._terminado = true;

        // Rechazar todo lo que quede en cola
        for (const { reject } of this.cola) {
            reject(new Error('Pool terminado'));
        }
        this.cola = [];

        // Rechazar pendientes
        for (const [id, pendiente] of this.pendientes) {
            clearTimeout(pendiente.timer);
            pendiente.reject(new Error('Pool terminado'));
        }
        this.pendientes.clear();

        // Terminar workers
        const promesas = this.workers.map(w => {
            if (w) return w.terminate();
            return Promise.resolve();
        });

        await Promise.allSettled(promesas);
        this.workers = [];
        this.disponibles = [];

        log.info('Worker Pool terminado');
    }
}

// ==========================================
// SINGLETON - Pool de Crypto Workers
// ==========================================

/**
 * Obtiene (o crea) la instancia singleton del pool de crypto workers.
 * @returns {WorkerPool}
 */
export function getCryptoPool() {
    if (!instanciaPool) {
        const numWorkers = calcularNumeroWorkers();
        const workerPath = path.join(__dirname, 'cryptoWorker.js');
        instanciaPool = new WorkerPool(workerPath, numWorkers, {
            timeoutMs: 30000,
            maxCola: 200
        });
    }
    return instanciaPool;
}

/**
 * Termina el pool singleton (para shutdown limpio).
 */
export async function terminarCryptoPool() {
    if (instanciaPool) {
        await instanciaPool.terminar();
        instanciaPool = null;
    }
}

// ==========================================
// SINGLETON - Pool de Escaner Workers
// ==========================================

let escanerInstanciaPool = null;

export function getEscanerPool() {
    if (!escanerInstanciaPool) {
        // Reducimos un poco la cantidad para no saturar todo el CPU solo con escáneres,
        // aunque workerPool calcula en base a CPUs disponibles
        const numWorkers = Math.max(1, calcularNumeroWorkers() - 1);
        const workerPath = path.join(__dirname, 'escanerWorker.js');
        escanerInstanciaPool = new WorkerPool(workerPath, numWorkers, {
            timeoutMs: 30000,
            maxCola: 500
        });
    }
    return escanerInstanciaPool;
}

export async function terminarEscanerPool() {
    if (escanerInstanciaPool) {
        await escanerInstanciaPool.terminar();
        escanerInstanciaPool = null;
    }
}
