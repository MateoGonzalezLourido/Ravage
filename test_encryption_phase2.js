import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { encriptarDatosSistema, desencriptarDatosSistema, hashDatosSistema } from './backend/services/cryptoService.js';
import { Añadir_Entrada_Buzon_Usuario, Revisar_Buzon_Usuario } from './backend/repositories/BuzonRepository.js';
import { CREAR_CHAT_NUEVO, obtener_datos_chats } from './backend/repositories/ChatRepository.js';
import { ENVIAR_MENSAJE, obtener_datos_mensaje } from './backend/repositories/MessageRepository.js';
import { InsertarVC, BuscarVC } from './backend/repositories/SecurityRepository.js';
import { User } from './backend/models/User.js';
import { ChatsRavage } from './backend/models/Chat.js';
import { MessagesRavage } from './backend/models/Message.js';
import { ValidationCode } from './backend/models/Security.js';
import { BuzonUsuarios } from './backend/models/Buzon.js';
import { setIDMongodbUsuario } from './backend/STORAGE/Variables_sesion.js';


dotenv.config();

async function runTests() {
    try {
        await mongoose.connect(process.env.URI_MONGODB);

        console.log("Conectado a MongoDB");

        // Limpiar colecciones de prueba
        await User.deleteMany({ correo_hash: hashDatosSistema("test_phase2@example.com") });
        await ChatsRavage.deleteMany({});
        await MessagesRavage.deleteMany({});
        await ValidationCode.deleteMany({});
        await BuzonUsuarios.deleteMany({});

        // 1. Crear usuario de prueba
        const userId = new mongoose.Types.ObjectId();
        const testUser = await User.create({
            _id: userId,
            apodo: encriptarDatosSistema("TestUser"),
            correo: encriptarDatosSistema("test_phase2@example.com"),
            correo_hash: hashDatosSistema("test_phase2@example.com"),
            contrasena: "hashed_password", // Obviamos el hash real para esta prueba
            idamigo: encriptarDatosSistema("friend_id"),
            idamigo_hash: hashDatosSistema("friend_id")
        });
        console.log("Usuario de prueba creado");

        // 2. Test Buzon
        console.log("\n--- Test Buzon ---");
        const buzonData = { info: "Mensaje de prueba" };
        await Añadir_Entrada_Buzon_Usuario({ ids: [userId], tipo: 1, data: buzonData });
        
        const buzonRaw = await BuzonUsuarios.findById(userId);

        console.log("Buzon en DB (encriptado):", JSON.stringify(buzonRaw.entrada[0].data));
        if (buzonRaw.entrada[0].data.data) console.log("✓ Campo 'data' está cifrado");

        setIDMongodbUsuario(userId);
        const buzonDecrypted = await Revisar_Buzon_Usuario();

        console.log("Buzon recuperado (desencriptado):", buzonDecrypted[0].data);
        if (buzonDecrypted[0].data.info === "Mensaje de prueba") console.log("✓ Desencriptación exitosa");

        // 3. Test Chat
        console.log("\n--- Test Chat ---");
        const chatNombre = "Grupo Secreto";
        const chatId = await CREAR_CHAT_NUEVO([userId.toHexString()], chatNombre);

        
        const chatRaw = await ChatsRavage.findById(chatId);
        console.log("Nombre del chat en DB (encriptado):", JSON.stringify(chatRaw.nombre));
        if (chatRaw.nombre.data) console.log("✓ Campo 'nombre' está cifrado");

        const chatsLista = await obtener_datos_chats({ data: [{ id: chatId.id || chatId }] });

        console.log("Nombre del chat recuperado:", chatsLista[0].nombre);
        if (chatsLista[0].nombre === chatNombre) console.log("✓ Desencriptación exitosa");

        // 4. Test Security
        console.log("\n--- Test Security ---");
        const testEmail = "test_phase2@example.com";
        const testCode = "123456";
        const deviceId = "test_device_123";
        await InsertarVC({ correo: testEmail, code: testCode, id: deviceId, data: { step: 1 } });
        
        const vcRaw = await ValidationCode.findOne({ correo_hash: hashDatosSistema(testEmail) });
        console.log("ValidationCode en DB (encriptado):", JSON.stringify(vcRaw.correo));
        if (vcRaw.correo_hash === hashDatosSistema(testEmail)) console.log("✓ Búsqueda por hash exitosa");
        if (vcRaw.correo.data) console.log("✓ Campo 'correo' está cifrado");
        if (vcRaw.id_dp_hash === hashDatosSistema(deviceId)) console.log("✓ Campo 'id_dp_hash' presente");

        const vcFound = await BuscarVC(testEmail, testCode, deviceId);
        console.log("Datos recuperados:", vcFound.correo, vcFound.data);
        if (vcFound.correo === testEmail && vcFound.data.step === 1) console.log("✓ Desencriptación exitosa");

        console.log("\n--- Todas las pruebas de Fase 2 completadas ---");

    } catch (err) {
        console.error("Fallo en las pruebas:", err);
    } finally {
        await mongoose.connection.close();
        process.exit();
    }
}

runTests();
