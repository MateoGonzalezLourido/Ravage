// Node nativo
import fs from 'fs';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// Electron
import { app, BrowserWindow, ipcMain, dialog } from 'electron';

// Dependencias externas
import { hash, compare } from 'bcryptjs';
import pkgMachineId from 'node-machine-id';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

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
    os
};
