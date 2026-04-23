import { mongoose } from "../utils/libs.js";
import { createLogger } from '../utils/logger.js';
const log = createLogger('db');

async function connectDB() {
    //esta conectado ya ?
    if (mongoose.connection.readyState === 1) return;
    
    //configruacion de la conexion a db
    await mongoose.connect(process.env.URI_MONGODB, {
        tls: true,
        tlsInsecure: false,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 1,
        connectTimeoutMS: 5000
    })
    .then(() => log.info("Conectado a MongoDB Atlas"))
    .catch((err) => log.error({ err }, "Error de conexión a MongoDB"));
}
async function closeDB() {
    //esta cerrado ya ?
    if (mongoose.connection.readyState === 0) return;

    await mongoose.disconnect();
    try {
        log.warn("Conexión a MongoDB cerrada");
    } catch {
        // Si el logger falla por el cierre de app, usamos pino de forma directa si fuera posible 
        // o consola como último recurso.
        console.warn("LOG: Conexión a MongoDB cerrada");
    }
}

mongoose.connection.on('disconnected', () => {
    //a veces falla el log si la app se esta cerrando
    try {
        log.warn('MongoDB desconectado');
    } catch {
        console.warn('LOG: MongoDB desconectado');
    }
});

export { connectDB, closeDB };
export { mongoose };