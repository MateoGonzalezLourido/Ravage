import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as libs from '../utils/libs.js';

// Mock de libs.js ANTES de importar el repositorio
vi.mock('../utils/libs.js', () => {
    class MockObjectId {
        constructor(id) { this._id = id; }
        toString() { return this._id; }
        static isValid(id) { return /^[0-9a-fA-F]{24}$/.test(id); }
    }

    const mockMongoose = {
        Types: {
            ObjectId: MockObjectId
        },
        Schema: vi.fn(function() {
            this.index = vi.fn();
            this.pre = vi.fn();
        }),
        model: vi.fn(() => ({
            findOne: vi.fn(),
            find: vi.fn(),
            findById: vi.fn(),
            create: vi.fn()
        }))
    };
    mockMongoose.Schema.Types = { ObjectId: MockObjectId };

    return {
        mongoose: mockMongoose,
        ObjectId: MockObjectId,
        createLogger: vi.fn(() => ({ error: vi.fn(), debug: vi.fn(), info: vi.fn() })),
        // ... (resto de funciones de Node)
        randomBytes: vi.fn(() => Buffer.from('mock')),
        generateKeyPair: vi.fn(),
        generateKeyPairSync: vi.fn(),
        createHash: vi.fn(),
        createCipheriv: vi.fn(),
        createDecipheriv: vi.fn(),
        publicEncrypt: vi.fn(),
        privateDecrypt: vi.fn(),
        createHmac: vi.fn(),
        randomInt: vi.fn(() => 1),
        constants: { RSA_PKCS1_OAEP_PADDING: 1 },
        fs: { writeFileSync: vi.fn(), readFileSync: vi.fn(), existsSync: vi.fn() },
        path: { join: vi.fn(), dirname: vi.fn(), basename: vi.fn(), extname: vi.fn() }
    };
});

// Ahora importamos después de los mocks iniciales
import { obtener_datos_chat_unico } from '../repositories/ChatRepository.js';
import { ChatsRavage } from '../models/Chat.js';
import { MessagesRavage } from '../models/Message.js';

// Mocks de modelos
vi.mock('../utils/logger.js', () => ({
    createLogger: vi.fn(() => ({ error: vi.fn(), debug: vi.fn(), info: vi.fn() }))
}));

vi.mock('../repositories/UserRepository.js', () => ({
    obtener_datos_usuario: vi.fn(() => ({ apodo: 'Usuario Mock' })),
    procesarUsuario: vi.fn((u) => u)
}));

vi.mock('../models/User.js', () => ({
    User: {
        findById: vi.fn(() => ({
            lean: vi.fn().mockResolvedValue({ apodo: 'Usuario Mock' })
        }))
    }
}));

vi.mock('../models/Chat.js', () => ({
    ChatsRavage: {
        findById: vi.fn(() => ({
            lean: vi.fn()
        }))
    }
}));

vi.mock('../models/Message.js', () => ({
    MessagesRavage: {
        find: vi.fn(() => ({
            sort: vi.fn(() => ({
                lean: vi.fn().mockResolvedValue([])
            }))
        }))
    }
}));



vi.mock('../STORAGE/Variables_sesion.js', () => ({
    getIDMongodbUsuario: vi.fn(() => 'user123')
}));

vi.mock('../services/messageCryptoService.js', () => ({
    descifrarListaMensajes: vi.fn((msgs) => msgs)
}));

vi.mock('../utils/conversores.js', () => ({
    convertirObjectId: vi.fn((obj) => ({ ...obj, id: obj._id?.toString() }))
}));

describe('ChatRepository - obtener_datos_chat_unico', () => {
    const mockId = '507f1f77bcf86cd799439011';
    const mockChat = {
        _id: mockId,
        nombre: 'Chat de Prueba',
        usuarios: ['user1', 'user2'],
        admins: ['user1'],
        fecha_creacion: new Date()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Inyectamos un mock manual de resolverNombresChats si es necesario
    });

    it('debe obtener el chat completo de la DB cuando no hay caché y no se filtran campos', async () => {
        try {
            vi.spyOn(ChatsRavage, 'findById').mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockChat)
            });

            const result = await obtener_datos_chat_unico(mockId);

            expect(result).not.toBeNull();
            expect(result.id).toBe(mockId);
        } catch (e) {
            console.error("DEBUG FAIL:", e);
            throw e;
        }
    });

    it('debe aplicar la proyección correctamente cuando se piden campos específicos', async () => {
        try {
            const findByIdSpy = vi.spyOn(ChatsRavage, 'findById').mockReturnValue({
                lean: vi.fn().mockResolvedValue({ _id: mockId, usuarios: ['user1', 'user2'] })
            });

            await obtener_datos_chat_unico(mockId, "usuarios nombre");

            expect(findByIdSpy).toHaveBeenCalledWith(mockId, { usuarios: 1, nombre: 1 });
        } catch (e) {
            console.error("DEBUG FAIL:", e);
            throw e;
        }
    });

    it('debe cargar mensajes si se solicita "mensajes"', async () => {
        try {
            const findByIdSpy = vi.spyOn(ChatsRavage, 'findById').mockReturnValue({
                lean: vi.fn().mockResolvedValue(mockChat)
            });
            
            await obtener_datos_chat_unico(mockId, "mensajes");
            expect(MessagesRavage.find).toHaveBeenCalled();
        } catch (e) {
            console.error("DEBUG FAIL:", e);
            throw e;
        }
    });
});
