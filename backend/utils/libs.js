import bcryptjs from 'bcryptjs';
import pkgMachineId from 'node-machine-id';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from "fs" //para subir archivos
// Extracting specific functions from CJS modules (extra optimizacion)
const { machineIdSync } = pkgMachineId;
const { sign, verify } = jwt;
const { hash, compare } = bcryptjs;
const { createHash, randomBytes, createCipheriv, createDecipheriv } = crypto;

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
    fs
};
