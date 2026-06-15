import { createLogger } from '../logger.js';
const log = createLogger('worker-pool');
import { Worker } from 'node:worker_threads';
import { os, path } from '../libs.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_WORKERS_CRYPTO = 4;
const MAX_WORKERS_ESCANER = 2;

let _userWorkersOverride = 0;

export function setNumWorkersOverride(n) {
    const cpus = os.cpus().length;
    const parsed = parseInt(n, 10);
    if (!parsed || parsed < 1) {
        _userWorkersOverride = 0;
    } else {
        _userWorkersOverride = Math.min(parsed, cpus);
    }
}

function calcularNumeroWorkers(max) {
    const cpusReales = os.cpus().length;

    if (_userWorkersOverride >= 1) {
        const resultado = Math.min(max, _userWorkersOverride);
        log.info(`Workers (usuario): ${resultado} de ${cpusReales} CPUs`);
        return resultado;
    }

    const envVal = process.env.MAX_CPU_CORES_PARALEL;

    if (!envVal || envVal.toLowerCase() === 'none') {
        const resultado = Math.min(max, Math.max(2, cpusReales - 1));
        log.info(`Workers (auto): ${resultado} de ${cpusReales} CPUs`);
        return resultado;
    }

    const pedido = parseInt(envVal, 10);
    if (isNaN(pedido) || pedido < 1) {
        log.warn(`MAX_CPU_CORES_PARALEL inválido ("${envVal}"), usando modo automático`);
        return Math.min(max, Math.max(2, cpusReales - 1));
    }

    if (pedido <= cpusReales) {
        const resultado = Math.min(max, pedido);
        log.info(`Workers (manual): ${resultado} de ${cpusReales} CPUs`);
        return resultado;
    }

    const fallback = Math.min(max, Math.max(1, cpusReales - 1));
    log.warn(`MAX_CPU_CORES_PARALEL=${pedido} excede CPUs reales (${cpusReales}), usando ${fallback}`);
    return fallback;
}

/** @type {WorkerPool | null} */
let instanciaPool = null;

class WorkerPool {
    constructor(workerPath, numWorkers, opciones = {}) {
        this.workerPath = workerPath;
        this.numWorkers = numWorkers;
        this.timeoutMs = opciones.timeoutMs || 30000;
        this.maxCola = opciones.maxCola || 500;
        this.idleTimeoutMs = opciones.idleTimeoutMs || 60000;
        this._onIdle = opciones.onIdle || null;
        this._idleTimer = null;

        /** @type {Worker[]} */
        this.workers = [];

        /** @type {Set<number>} */
        this.libres = new Set();

        /** @type {Array} */
        this.cola = [];
        this._colaHead = 0;

        /** @type {Map<number, {resolve: Function, reject: Function, timer: NodeJS.Timeout, workerIndex: number}>} */
        this.pendientes = new Map();

        this._idCounter = 0;
        this._terminado = false;
        this._inicializado = false;
    }

    _resetIdleTimer() {
        clearTimeout(this._idleTimer);
        this._idleTimer = setTimeout(async () => {
            log.info(`Worker Pool inactivo ${this.idleTimeoutMs}ms, destruyendo...`);
            await this.terminar();
            if (this._onIdle) this._onIdle();
        }, this.idleTimeoutMs);
    }

    _inicializar() {
        if (this._inicializado) return;
        this._inicializado = true;

        for (let i = 0; i < this.numWorkers; i++) {
            this._crearWorker(i);
        }

        log.info(`Worker Pool inicializado: ${this.numWorkers} workers con "${path.basename(this.workerPath)}"`);
    }

    _crearWorker(indice) {
        const worker = new Worker(this.workerPath);
        this.workers[indice] = worker;
        this.libres.add(indice);

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

    _reemplazarWorker(indice) {
        if (this._terminado) return;
        try {
            this._crearWorker(indice);
            this._procesarCola();
        } catch (err) {
            log.error({ err, workerIndex: indice }, 'Fallo al reiniciar worker');
        }
    }

    _rechazarPendientesWorker(indice, error) {
        for (const [id, pendiente] of this.pendientes) {
            if (pendiente.workerIndex === indice) {
                clearTimeout(pendiente.timer);
                pendiente.reject(error);
                this.pendientes.delete(id);
            }
        }
    }

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

        this.libres.add(indice);
        this._procesarCola();
    }

    _procesarCola() {
        while (this._colaHead < this.cola.length) {
            const idxLibre = this.libres.values().next().value;
            if (idxLibre === undefined) break;

            const { tarea, resolve, reject } = this.cola[this._colaHead];
            delete this.cola[this._colaHead];
            this._colaHead++;

            if (this._colaHead > 100) {
                this.cola = this.cola.slice(this._colaHead);
                this._colaHead = 0;
            }

            this._enviarAlWorker(idxLibre, tarea, resolve, reject);
        }
    }

    _enviarAlWorker(indice, tarea, resolve, reject) {
        const id = ++this._idCounter;
        this.libres.delete(indice);

        const timer = setTimeout(() => {
            this.pendientes.delete(id);
            this.libres.add(indice);
            reject(new Error(`Worker timeout (${this.timeoutMs}ms) en tarea "${tarea.tipo}"`));
            this._procesarCola();
        }, this.timeoutMs);

        this.pendientes.set(id, { resolve, reject, timer, workerIndex: indice });

        try {
            this.workers[indice].postMessage({ id, tipo: tarea.tipo, datos: tarea.datos });
        } catch (err) {
            clearTimeout(timer);
            this.pendientes.delete(id);
            this.libres.add(indice);
            log.error({ err, tipo: tarea.tipo }, "Error de serialización IPC");
            reject(new Error(`Error al serializar datos para el worker: ${err.message}`));
            this._procesarCola();
        }
    }

    ejecutar(tipo, datos = {}) {
        if (this._terminado) return Promise.reject(new Error('Pool terminado'));
        this._inicializar();
        this._resetIdleTimer();

        return new Promise((resolve, reject) => {
            const tarea = { tipo, datos };

            const idxLibre = this.libres.values().next().value;
            if (idxLibre !== undefined) {
                this._enviarAlWorker(idxLibre, tarea, resolve, reject);
            } else {
                if (this.cola.length - this._colaHead >= this.maxCola) {
                    reject(new Error(`Cola del pool llena (${this.maxCola} tareas)`));
                    return;
                }
                this.cola.push({ tarea, resolve, reject });
            }
        });
    }

    async ejecutarBatch(tipo, items, datosComunes = {}) {
        if (this._terminado) throw new Error('Pool terminado');
        if (!items || items.length === 0) return [];
        this._inicializar();
        this._resetIdleTimer();

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

        const resultados = await Promise.all(
            chunks.map(chunk =>
                this.ejecutar(tipo, {
                    ...datosComunes,
                    items: chunk.items,
                    indiceInicio: chunk.indiceInicio
                })
            )
        );

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

    async terminar() {
        this._terminado = true;
        clearTimeout(this._idleTimer);

        for (let i = this._colaHead; i < this.cola.length; i++) {
            if (this.cola[i]) this.cola[i].reject(new Error('Pool terminado'));
        }
        this.cola = [];
        this._colaHead = 0;

        for (const [id, pendiente] of this.pendientes) {
            clearTimeout(pendiente.timer);
            pendiente.reject(new Error('Pool terminado'));
        }
        this.pendientes.clear();
        this.libres.clear();

        const promesas = this.workers.map(w => {
            if (w) return w.terminate();
            return Promise.resolve();
        });

        await Promise.allSettled(promesas);
        this.workers = [];

        log.info('Worker Pool terminado');
    }
}

// ==========================================
// SINGLETON - Pool de Crypto Workers
// ==========================================

export function getCryptoPool() {
    if (!instanciaPool || instanciaPool._terminado) {
        const numWorkers = calcularNumeroWorkers(MAX_WORKERS_CRYPTO);
        const workerPath = path.join(__dirname, 'cryptoWorker.js');
        instanciaPool = new WorkerPool(workerPath, numWorkers, {
            timeoutMs: 30000,
            maxCola: 200,
            idleTimeoutMs: 60000,
            onIdle: () => { instanciaPool = null; }
        });
    }
    return instanciaPool;
}

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
    if (!escanerInstanciaPool || escanerInstanciaPool._terminado) {
        const numWorkers = calcularNumeroWorkers(MAX_WORKERS_ESCANER);
        const workerPath = path.join(__dirname, 'escanerWorker.js');
        escanerInstanciaPool = new WorkerPool(workerPath, numWorkers, {
            timeoutMs: 30000,
            maxCola: 500,
            idleTimeoutMs: 60000,
            onIdle: () => { escanerInstanciaPool = null; }
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

export async function aplicarNuevoNumWorkers(n) {
    setNumWorkersOverride(n);
    await Promise.allSettled([terminarCryptoPool(), terminarEscanerPool()]);
}