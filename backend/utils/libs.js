// ==========================================
// 1. NATIVE NODE.JS MODULES
// ==========================================
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { 
    createHash, 
    randomBytes, 
    createCipheriv, 
    createDecipheriv, 
    generateKeyPairSync, 
    publicEncrypt, 
    privateDecrypt, 
    createHmac 
} from "node:crypto";

// ==========================================
// 2. ELECTRON (With fallback mocks)
// ==========================================
let app, BrowserWindow, ipcMain, dialog;

try {
    // Import electron only if in an Electron process
    const electron = await import('electron');
    app = electron.app;
    BrowserWindow = electron.BrowserWindow;
    ipcMain = electron.ipcMain;
    dialog = electron.dialog;
} catch (e) {
    // Mocks for pure Node.js environments
    app = { getPath: () => '/tmp', on: () => { }, emit: () => { }, quit: () => { } };
    BrowserWindow = class { };
    ipcMain = { on: () => { }, handle: () => { } };
    dialog = { showOpenDialog: () => { }, showSaveDialog: () => { } };
}

// ==========================================
// 3. EXTERNAL LIBRARIES
// ==========================================
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import si from 'systeminformation';
import pkgMachineId from 'node-machine-id';
import { Server as SocketServer } from 'socket.io';
import { hash, compare } from 'bcrypt';
import { GridFSBucket, ObjectId } from 'mongodb';

// ==========================================
// 4. UTILITIES & CONSTANTS
// ==========================================
const { machineIdSync } = pkgMachineId;
const { sign, verify } = jwt;

// ESM __dirname & __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// 5. EXPORTS
// ==========================================
export {
    // Node.js Core
    fs,
    path,
    os,
    http,
    https,
    Transform,
    __dirname,
    __filename,

    // Cryptography (Native)
    createHash,
    randomBytes,
    createCipheriv,
    createDecipheriv,
    generateKeyPairSync,
    publicEncrypt,
    privateDecrypt,
    createHmac,

    // Electron
    app,
    BrowserWindow,
    ipcMain,
    dialog,

    // Security & Auth
    hash,
    compare,
    sign,
    verify,
    machineIdSync,

    // Database
    mongoose,
    GridFSBucket,
    ObjectId,

    // Server & Networking
    express,
    SocketServer as Server,

    // Other Utils
    validator,
    si
};


