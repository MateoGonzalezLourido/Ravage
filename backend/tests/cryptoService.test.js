import { describe, it, expect, beforeAll } from 'vitest';
import { 
    encriptarDatosSistema, 
    desencriptarDatosSistema, 
    hashDatosSistema, 
    generarLlavesRSA, 
    cifrarConPublica, 
    descifrarConPrivada,
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

        it('should return original object if tag is tampered', () => {
            const secretData = "IntegrityCheck";
            const encrypted = encriptarDatosSistema(secretData);
            
            // Tamper the tag
            encrypted.tag = '00'.repeat(16);
            
            const decrypted = desencriptarDatosSistema(encrypted);
            expect(decrypted).toEqual(encrypted); // Returns original object on failure
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

    describe('RSA Operations', () => {
        it('should encrypt with public key and decrypt with private key', async () => {
            const { publicKey, privateKey } = await generarLlavesRSA();
            const originalText = "Hello RSA World";
            
            const encryptedHex = cifrarConPublica(originalText, publicKey);
            expect(typeof encryptedHex).toBe('string');
            
            const decryptedText = descifrarConPrivada(encryptedHex, privateKey);
            expect(decryptedText).toBe(originalText);
        });

        it('should throw error when decrypting with wrong key or format', async () => {
            const { publicKey } = await generarLlavesRSA();
            const { privateKey: wrongPrivateKey } = await generarLlavesRSA();
            
            const encryptedHex = cifrarConPublica("Secret", publicKey);
            
            expect(() => descifrarConPrivada(encryptedHex, wrongPrivateKey)).toThrow();
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
