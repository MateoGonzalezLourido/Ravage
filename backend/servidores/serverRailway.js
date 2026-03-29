import { express, Server, http } from "../utils/libs.js";
import { connectDB } from "../db/mongo.js";
import { createLogger } from '../utils/logger.js';
const log = createLogger('server-railway');

let appServer;
let io;

/**
 * Inicia el servidor optimizado para despliegue en Railway.
 * Maneja el puerto dinámico y expone un endpoint de salud.
 */
async function startServer() {
    log.info("Iniciando servidor en modo PRODUCCIÓN (Railway)...");

    const app = express();
    app.set('trust proxy', 1); // Confiar en el proxy de Railway para obtener la IP real
    app.use(express.json());

    // Middleware de Rate Limiting Global (Servidor)
    const rateLimit = await import('express-rate-limit');
    const globalLimiter = rateLimit.default({
        windowMs: 15 * 60 * 1000,
        max: 100, // Límite generoso para el servidor Socket.IO
        message: "Demasiadas peticiones desde esta IP, por favor intenta más tarde."
    });
    app.use(globalLimiter);

    // Configuración de CORS segura para PRODUCCIÓN
    app.use((req, res, next) => {
        const allowedOrigin = process.env.CLIENT_URL || "*";
        res.header("Access-Control-Allow-Origin", allowedOrigin);
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
        
        if (req.method === "OPTIONS") {
            return res.sendStatus(200);
        }
        next();
    });

    // Railway proporciona el puerto dinámicamente mediante la variable de entorno PORT.
    const PORT = process.env.PORT || 8080;


    // Health Check: Fundamental para que el orquestador de Railway sepa que el servicio está vivo.
    app.get("/", (req, res) => {
        res.status(200).send("Servidor Ravage (Railway) está activo y funcionando.");
    });

    const server = http.createServer(app);

    // Configuración de Socket.IO para Railway
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "*", 
            methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling'] // Recomendado para mayor compatibilidad
    });


    io.on("connection", (socket) => {
        log.info({ socketId: socket.id }, "Cliente conectado");

        socket.on("identificar", (userId) => {
            socket.join(userId);
            socket.userId = userId;
            log.info({ userId }, "Usuario identificado");
        });

        socket.on("disconnect", () => {
            if (socket.userId) {
                log.info({ userId: socket.userId }, "Usuario desconectado");
            }
        });
    });

    // Levantamos el servidor escuchando en todas las interfaces (0.0.0.0)
    appServer = server.listen(PORT, '0.0.0.0', () => {
        log.info({ port: PORT, protocol: 'http', host: '0.0.0.0' }, "Servidor Express + Socket.IO desplegado");
    });


    return io;
}

function stopServer() {
    if (appServer) {
        appServer.close(() => log.warn("Servidor de producción cerrado"));
    }
}

// Lógica para permitir ejecución directa (para Railway)
if (process.argv[1]?.includes('serverRailway.js')) {
    (async () => {
        try {
            await connectDB();
            await startServer();
        } catch (error) {
            log.fatal({ err: error }, "Error al iniciar el servidor en Railway");
            process.exit(1);
        }
    })();
}

export { startServer, stopServer, io };