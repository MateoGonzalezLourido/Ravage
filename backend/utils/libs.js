// Node nativo
import fs from 'fs';
import { Transform } from 'stream';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// Electron
let app, BrowserWindow, ipcMain, dialog;
try {
    // Intentar importar electron solo si estamos en un proceso de Electron
    // Si falla (por ejemplo, ejecutando con node puro), usamos mocks
    const electron = await import('electron');
    app = electron.app;
    BrowserWindow = electron.BrowserWindow;
    ipcMain = electron.ipcMain;
    dialog = electron.dialog;
} catch (e) {
    app = { getPath: () => '/tmp', on: () => {} };
    BrowserWindow = class {};
    ipcMain = { on: () => {}, handle: () => {} };
    dialog = { showOpenDialog: () => {}, showSaveDialog: () => {} };
}


// Dependencias externas
import { hash, compare } from 'bcrypt';
import pkgMachineId from 'node-machine-id';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import validator from 'validator';

// Mongoose & MongoDB
import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';

// Express, HTTP & Socket.IO
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

// Funciones extraídas
const { machineIdSync } = pkgMachineId;
const { sign, verify } = jwt;
// Opcional: definir __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export {
    // Bcrypt
    hash,
    compare,
    // Machine ID
    machineIdSync,
    // JWT
    sign,
    verify,
    // Crypto
    createHash,
    randomBytes,
    createCipheriv,
    createDecipheriv,
    //node 
    path,
    fs,
    //Electron
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    //Path
    __dirname,
    __filename,
    // Mongoose & MongoDB
    mongoose,
    GridFSBucket,
    ObjectId,
    // Express, HTTP & Socket.IO
    express,
    http,
    Server,
    os,
    Transform,
    //validacion datos
    validator
};
