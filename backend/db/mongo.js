import { mongoose } from "../utils/libs.js";

async function connectDB() {
    await mongoose.connect(process.env.URI_MONGODB, {
        tls: true,
        tlsInsecure: false,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
    })
    .then(() => console.log("(+) Conectado a MongoDB Atlas"))
    .catch((err) => console.error("(-) Error de conexión:", err));
}

async function closeDB() {
    if (mongoose.connection.readyState === 0) return;
    await mongoose.disconnect();
    console.warn("(-) Cerrado MongoDB");
}

function estaConectado() {
    return mongoose.connection.readyState !== 0;
}

mongoose.connection.on('disconnected', () => {
    console.warn('(-) MongoDB desconectado.');
});

export { connectDB, closeDB, estaConectado };
export { mongoose };