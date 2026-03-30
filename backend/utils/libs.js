/*IMPORTANTE: libs.js se encarga de cargar todas(o casi todas) las librerias necesarias para el funcionamiento de la aplicacion, se encarga de cargar las librerias de forma perezosa para mejorar el rendimiento de la aplicacion, por lo que cuando necesites importar librerias, si proceden de aqui pudes hacerlo de forma estatica sin perder rendimiento, si no proceden de aqui procura hacerlo dinámicamente (si se puede) para mejorar el rendimiento*/

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// ==========================================
// 1. AYUDANTE DE CARGA PEREZOSA (LAZY)
// ==========================================
function lazy(nameOrFactory) {
    let cache;
    const load = () => {
        if (!cache) {
            cache = typeof nameOrFactory === 'string'
                ? require(nameOrFactory)
                : nameOrFactory();
        }
        return cache;
    };

    return new Proxy(() => { }, {
        apply: (target, thisArg, args) => load()(...args),
        construct: (target, args) => new (load())(...args),
        get: (target, prop) => load()[prop]
    });
}

// ==========================================
// 2. NATIVE NODE.JS MODULES
// ==========================================
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';
import {
    createHash, randomBytes, createCipheriv, createDecipheriv,
    generateKeyPairSync, generateKeyPair, publicEncrypt,
    privateDecrypt, createHmac, constants, randomInt
} from "node:crypto";

import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// 3. ELECTRON (Lazy & Safe)
// ==========================================
const electronLoader = () => {
    try {
        return require('electron');
    } catch {
        return {
            app: { getPath: () => '/tmp', on: () => { }, emit: () => { }, quit: () => { } },
            BrowserWindow: class { },
            ipcMain: { on: () => { }, handle: () => { } },
            dialog: { showOpenDialog: () => { }, showSaveDialog: () => { } }
        };
    }
};

const electron = lazy(electronLoader);

// Helper para crear un proxy que preserve el contexto 'this' de Electron
function createElectronProxy(name) {
    return new Proxy(function() {}, {
        get: (target, prop) => {
            const comp = electron[name];
            const val = comp[prop];
            return typeof val === 'function' ? val.bind(comp) : val;
        },
        construct: (target, args) => {
            const Comp = electron[name];
            return new Comp(...args);
        }
    });
}

export const app = createElectronProxy('app');
export const BrowserWindow = createElectronProxy('BrowserWindow');
export const ipcMain = createElectronProxy('ipcMain');
export const dialog = createElectronProxy('dialog');

// ==========================================
// 4. EXTERNAL LIBRARIES (¡Perezosas!)
// ==========================================
export const express = lazy('express');
export const mongoose = lazy('mongoose');
export const validator = lazy('validator');
export const si = lazy('systeminformation');
const bcrypt = lazy('bcrypt');
const jwt = lazy('jsonwebtoken');
const mongodb = lazy('mongodb');
const socketio = lazy('socket.io');
export const Server = new Proxy(function() {}, {
    get: (target, prop) => require('socket.io').Server[prop],
    construct: (target, args) => new (require('socket.io').Server)(...args),
    apply: (target, thisArg, args) => require('socket.io').Server(...args)
});

export const hash = (...args) => bcrypt.hash(...args);
export const compare = (...args) => bcrypt.compare(...args);
export const sign = (...args) => jwt.sign(...args);
export const verify = (...args) => jwt.verify(...args);
export const machineIdSync = (...args) => require('node-machine-id').machineIdSync(...args);

export const GridFSBucket = new Proxy(function() {}, {
    get: (target, prop) => require('mongodb').GridFSBucket[prop],
    construct: (target, args) => new (require('mongodb').GridFSBucket)(...args)
});

export const ObjectId = new Proxy(function() {}, {
    get: (target, prop) => require('mongodb').ObjectId[prop],
    construct: (target, args) => new (require('mongodb').ObjectId)(...args)
});

// ==========================================
// 5. NATIVE EXPORTS
// ==========================================
export {
    fs, path, os, http, https, Transform, __dirname, __filename,
    createHash, randomBytes, createCipheriv, createDecipheriv,
    generateKeyPairSync, generateKeyPair, publicEncrypt,
    privateDecrypt, createHmac, constants, randomInt
};
