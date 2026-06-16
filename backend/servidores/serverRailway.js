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

    // Orígenes permitidos: CLIENT_URL puede ser una URL o lista separada por comas
    const rawClientUrl = process.env.CLIENT_URL;
    if (!rawClientUrl) {
        log.fatal('Variable de entorno CLIENT_URL no definida — CORS bloqueará todas las peticiones de origen cruzado');
    }
    const ALLOWED_ORIGINS = rawClientUrl
        ? rawClientUrl.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const app = express();
    app.set('trust proxy', 1); // Confiar en el proxy de Railway para obtener la IP real
    app.use(express.json());

    // Middleware de Rate Limiting Global (Servidor)
    const rateLimit = await import('express-rate-limit');
    const globalLimiter = rateLimit.default({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: "Demasiadas peticiones desde esta IP, por favor intenta más tarde."
    });
    app.use(globalLimiter);

    // CORS: fail-closed si CLIENT_URL no está definida; Vary:Origin para proxies/CDN
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin && ALLOWED_ORIGINS.includes(origin)) {
            res.header("Access-Control-Allow-Origin", origin);
            res.header("Vary", "Origin");
        }
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (req.method === "OPTIONS") return res.sendStatus(204);
        next();
    });

    // Railway proporciona el puerto dinámicamente mediante la variable de entorno PORT.
    const PORT = process.env.PORT || 8080;


    // Health Check: Fundamental para que el orquestador de Railway sepa que el servicio está vivo.
    app.get("/", (req, res) => {
        res.status(200).send("Servidor Ravage (Railway) está activo y funcionando.");
    });

    const server = http.createServer(app);

    // Configuración de Socket.IO para Railway — mismos orígenes que Express
    io = new Server(server, {
        cors: {
            origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : false,
            methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling']
    });


    const socketSecret = process.env.SOCKET_SECRET;
    if (!socketSecret) {
        log.fatal('Variable de entorno SOCKET_SECRET no definida — el servidor Socket.IO no admitirá conexiones');
    }

    io.use((socket, next) => {
        if (socketSecret && socket.handshake.auth?.token === socketSecret) return next();
        log.warn({ socketId: socket.id, ip: socket.handshake.address }, 'Conexión Socket.IO rechazada: token inválido');
        next(new Error('No autorizado'));
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