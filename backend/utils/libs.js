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
            try {
                cache = typeof nameOrFactory === 'string' ? require(nameOrFactory) : nameOrFactory();
            } catch (err) {
                console.error(`ERROR cargando ${nameOrFactory}:`, err);
                throw err;
            }
        }
        return cache;
    };

    return new Proxy(function() {}, {
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
    privateDecrypt, createHmac, constants, randomInt,createPublicKey,createPrivateKey
} from "node:crypto";
import { gzipSync, gunzipSync, deflateSync, inflateSync } from "node:zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.config') });
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.secret') });

// ==========================================
// 3. ELECTRON (Lazy & Safe)
// ==========================================
const electronLoader = () => {
    try {
        return require('electron');
    } catch (err) {
        // En entorno de Node puro (como tests de importación) devolver mocks básicos
        const mockPath = (p) => `${process.cwd()}/${p || 'tmp'}`;
        return {
            app: { 
                getPath: mockPath, 
                on: () => { }, 
                emit: () => { }, 
                quit: () => { },
                isReady: () => false,
                whenReady: () => Promise.resolve()
            },
            ipcMain: { on: () => { }, handle: () => { }, removeHandler: () => { } },
            BrowserWindow: class { 
                constructor() { this.webContents = { setFrameRate: () => { }, executeJavaScript: () => { } }; }
                loadFile() { }
                maximize() { }
                show() { }
                on() { }
                once() { }
            },
            dialog: { showOpenDialog: () => Promise.resolve({ canceled: true }), showSaveDialog: () => Promise.resolve({ canceled: true }) }
        };
    }
};

const electron = lazy(electronLoader);

// Helper para crear un proxy que preserve el contexto 'this' de Electron
function createElectronProxy(name) {
    return new Proxy(function () { }, {
        get: (target, prop) => {
            const comp = electron[name];
            const val = comp ? comp[prop] : undefined;
            
            if (typeof val === 'function') return val.bind(comp);
            if (val !== undefined) return val;

            // Fallback para métodos si comp no existe o no tiene la propiedad
            if (prop === 'getPath') return (p) => `${process.cwd()}/${p || 'tmp'}`;
            if (prop === 'whenReady') return () => Promise.resolve();
            if (prop === 'isReady') return () => false;
            
            return () => { };
        },
        construct: (target, args) => {
            const Comp = electron[name];
            if (typeof Comp === 'function') {
                try { return new Comp(...args); } catch (e) { return {}; }
            }
            return {};
        }
    });
}

export const app = createElectronProxy('app');
export const BrowserWindow = createElectronProxy('BrowserWindow');
export const ipcMain = createElectronProxy('ipcMain');
export const ipcRenderer = createElectronProxy('ipcRenderer');
export const dialog = createElectronProxy('dialog');
export const Tray = createElectronProxy('Tray');
export const Menu = createElectronProxy('Menu');
export const nativeImage = createElectronProxy('nativeImage');
export const ElectronNotification = createElectronProxy('Notification');
export const safeStorage = createElectronProxy('safeStorage');

// ==========================================
// 4. EXTERNAL LIBRARIES (¡Perezosas!)
// ==========================================
export const express = lazy('express');
export const mongoose = lazy('mongoose');
export const validator = lazy('validator');
export const si = lazy('systeminformation');
const argon2 = lazy('argon2');
const jwt = lazy('jsonwebtoken');
const mongodb = lazy('mongodb');
const socketio = lazy('socket.io');
export const Server = new Proxy(function() {}, {
    get: (target, prop) => require('socket.io').Server[prop],
    construct: (target, args) => new (require('socket.io').Server)(...args),
    apply: (target, thisArg, args) => require('socket.io').Server(...args)
});

// Argon2id — OWASP recomendado. Parámetros por defecto del módulo: m=65536, t=3, p=4
export const hash = (password) => argon2.hash(password, { type: argon2.argon2id });
export const compare = (password, storedHash) => argon2.verify(storedHash, password);
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
    privateDecrypt, createHmac, constants, randomInt,createPublicKey,createPrivateKey,
    gzipSync, gunzipSync, deflateSync, inflateSync
};
