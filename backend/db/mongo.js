import { mongoose } from "../utils/libs.js";
import { createLogger } from '../utils/logger.js';
const log = createLogger('db');

async function connectDB() {
    await mongoose.connect(process.env.URI_MONGODB, {
        tls: true,
        tlsInsecure: false,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
    })
    .then(() => log.info("Conectado a MongoDB Atlas"))
    .catch((err) => log.error({ err }, "Error de conexión a MongoDB"));
}

async function closeDB() {
    if (mongoose.connection.readyState === 0) return;
    await mongoose.disconnect();
    log.warn("Conexión a MongoDB cerrada");
}

function estaConectado() {
    return mongoose.connection.readyState !== 0;
}

mongoose.connection.on('disconnected', () => {
    log.warn('MongoDB desconectado');
});

export { connectDB, closeDB, estaConectado };
export { mongoose };