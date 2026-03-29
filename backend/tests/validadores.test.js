import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    comprobaciones_Correo, 
    comprobar_apodo, 
    comprobarContrasenaValidaciones, 
    comprobar_idAmigo,
    comprobar_codigo_verificacion,
    comprobar_mensaje,
    comprobar_nombre_archivo,
    comprobar_contraseña_cuenta
} from '../services/validadores.js';

// Mocks
vi.mock('../models/User.js', () => ({
    User: {
        findOne: vi.fn()
    }
}));

vi.mock('../STORAGE/Variables_sesion.js', () => ({
    getCorreoSesion: vi.fn(),
    getIDMongodbUsuario: vi.fn()
}));

vi.mock('../utils/libs.js', () => ({
    compare: vi.fn(),
    validator: {
        isEmail: (str) => String(str).includes('@'), // Simple mock for testing
        isAlphanumeric: (str) => /^[a-zA-Z0-9_-]+$/.test(str),
        isNumeric: (str) => /^\d+$/.test(str)
    }
}));

describe('Validadores Unit Tests', () => {

    describe('Email Validation', () => {
        it('should validate correct emails', () => {
            expect(comprobaciones_Correo("test@ravage.net").success).toBe(true);
        });

        it('should fail on uppercase characters', () => {
            expect(comprobaciones_Correo("Test@ravage.net").success).toBe(false);
        });

        it('should fail on invalid format', () => {
            expect(comprobaciones_Correo("invalid-email").success).toBe(false);
        });

        it('should fail if too long', () => {
            const longEmail = "a".repeat(250) + "@test.com";
            expect(comprobaciones_Correo(longEmail).success).toBe(false);
        });
    });

    describe('Nickname (Apodo) Validation', () => {
        it('should validate safe alphanumeric nicknames', () => {
            expect(comprobar_apodo("Mateo_123").success).toBe(true);
            expect(comprobar_apodo("user-name").success).toBe(true);
        });

        it('should fail on special characters', () => {
            expect(comprobar_apodo("mateo!").success).toBe(false);
        });

        it('should fail on short or long nicknames', () => {
            expect(comprobar_apodo("ab").success).toBe(false); // Too short
            expect(comprobar_apodo("a".repeat(21)).success).toBe(false); // Too long
        });
    });

    describe('Password Validation', () => {
        it('should validate passwords >= 8 chars', () => {
            expect(comprobarContrasenaValidaciones("12345678").success).toBe(true);
        });

        it('should fail if too short', () => {
            expect(comprobarContrasenaValidaciones("1234567").success).toBe(false);
        });
    });

    describe('Friend ID (idAmigo) Validation', () => {
        it('should validate 10-char uppercase hex IDs', () => {
            expect(comprobar_idAmigo("A1B2C3D4E5").success).toBe(true);
        });

        it('should fail on lowercase', () => {
            expect(comprobar_idAmigo("a1b2c3d4e5").success).toBe(false);
        });

        it('should fail on wrong length', () => {
            expect(comprobar_idAmigo("A1B2C3D4").success).toBe(false);
        });
    });

    describe('Verification Code Validation', () => {
        it('should validate 6-digit numeric codes', () => {
            expect(comprobar_codigo_verificacion("123456").success).toBe(true);
        });

        it('should fail on alpha or wrong length', () => {
            expect(comprobar_codigo_verificacion("12345a").success).toBe(false);
            expect(comprobar_codigo_verificacion("12345").success).toBe(false);
        });
    });

    describe('Message and File Name Validation', () => {
        it('should validate non-empty message', () => {
            expect(comprobar_mensaje("Hello").success).toBe(true);
        });

        it('should fail on empty message', () => {
            expect(comprobar_mensaje("   ").success).toBe(false);
        });

        it('should block illegal file name characters', () => {
            expect(comprobar_nombre_archivo("normal.txt").success).toBe(true);
            expect(comprobar_nombre_archivo("bad/file.txt").success).toBe(false);
            expect(comprobar_nombre_archivo("illegal*char.jpg").success).toBe(false);
        });
    });
});
