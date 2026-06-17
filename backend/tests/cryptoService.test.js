import { describe, it, expect, beforeAll } from 'vitest';
import {
    encriptarDatosSistema,
    desencriptarDatosSistema,
    hashDatosSistema,
    generarLlavesX25519,
    cifrarConX25519,
    descifrarConX25519,
    ratchetChainKey
} from '../services/cryptoService.js';

describe('CryptoService Unit Tests', () => {
    // Setup for AES-GCM tests
    beforeAll(() => {
        process.env.INTERNAL_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars = 32 bytes
    });

    describe('System Data Encryption (AES-GCM)', () => {
        it('should encrypt and decrypt string data correctly', () => {
            const secretData = "RavageSecretMessage";
            const encrypted = encriptarDatosSistema(secretData);
            
            expect(encrypted).toHaveProperty('data');
            expect(encrypted).toHaveProperty('iv');
            expect(encrypted).toHaveProperty('tag');
            
            const decrypted = desencriptarDatosSistema(encrypted);
            expect(decrypted).toBe(secretData);
        });

        it('should encrypt and decrypt object data correctly', () => {
            const secretObj = { id: 123, role: 'admin' };
            const encrypted = encriptarDatosSistema(secretObj);
            const decrypted = JSON.parse(desencriptarDatosSistema(encrypted));
            
            expect(decrypted).toEqual(secretObj);
        });

        it('should return null if tag is tampered to prevent data leaks', () => {
            const secretData = "IntegrityCheck";
            const encrypted = encriptarDatosSistema(secretData);
            
            // Tamper the tag
            encrypted.tag = '00'.repeat(16);
            
            const decrypted = desencriptarDatosSistema(encrypted);
            expect(decrypted).toBeNull(); // Ahora retorna null para evitar crashes
        });
    });

    describe('Hashing (SHA-256)', () => {
        it('should generate consistent SHA-256 hashes', () => {
            const input = "user@example.com";
            const hash1 = hashDatosSistema(input);
            const hash2 = hashDatosSistema(input);
            
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // Hex string of 256 bits
        });

        it('should return null for empty input', () => {
            expect(hashDatosSistema(null)).toBe(null);
            expect(hashDatosSistema(undefined)).toBe(null);
        });
    });

    describe('X25519 Key Wrapping', () => {
        it('should wrap and unwrap a chain key', async () => {
            const { publicKey, privateKey } = await generarLlavesX25519();
            const chainKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

            const envuelta = cifrarConX25519(chainKey, publicKey);
            expect(envuelta).toHaveProperty('ephPub');
            expect(envuelta).toHaveProperty('iv');
            expect(envuelta).toHaveProperty('data');
            expect(envuelta).toHaveProperty('tag');

            const recovered = descifrarConX25519(envuelta, privateKey);
            expect(recovered).toBe(chainKey);
        });

        it('should produce different ciphertexts for the same key (ephemeral)', async () => {
            const { publicKey } = await generarLlavesX25519();
            const chainKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

            const env1 = cifrarConX25519(chainKey, publicKey);
            const env2 = cifrarConX25519(chainKey, publicKey);
            expect(env1.ephPub).not.toBe(env2.ephPub);
        });

        it('should throw when decrypting with wrong key', async () => {
            const { publicKey } = await generarLlavesX25519();
            const { privateKey: wrongKey } = await generarLlavesX25519();
            const chainKey = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

            const envuelta = cifrarConX25519(chainKey, publicKey);
            expect(() => descifrarConX25519(envuelta, wrongKey)).toThrow();
        });
    });

    describe('Sender Key Ratchet', () => {
        it('should derive deterministic message and chain keys', () => {
            const initialChainKey = 'abcdef0123456789abcdef0123456789';
            
            const step1 = ratchetChainKey(initialChainKey);
            expect(step1.messageKey).toBeInstanceOf(Buffer);
            expect(step1.nextChainKey).toHaveLength(64);
            
            const step1Repeat = ratchetChainKey(initialChainKey);
            expect(step1.nextChainKey).toBe(step1Repeat.nextChainKey);
            expect(step1.messageKey.toString('hex')).toBe(step1Repeat.messageKey.toString('hex'));
            
            // Step 2
            const step2 = ratchetChainKey(step1.nextChainKey);
            expect(step2.nextChainKey).not.toBe(step1.nextChainKey);
        });
    });
});
