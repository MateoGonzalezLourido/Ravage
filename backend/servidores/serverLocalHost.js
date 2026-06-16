import { express, Server, http, __dirname, randomBytes } from "../utils/libs.js";
import { createLogger } from '../utils/logger.js';
const log = createLogger('server-local');
//import { https, fs, path } from "../utils/libs.js";

let appServer;
let io;
let _socketSecret = null;

export function getSocketSecret() { return _socketSecret; }

/**
 * Inicia el servidor optimizado para desarrollo local.
 */
// Acepta cualquier puerto de localhost — el puerto real se asigna dinámicamente al arrancar
const ALLOWED_ORIGINS_LOCAL = /^http:\/\/localhost(:\d+)?$/;

async function startServer() {
    log.info("Iniciando servidor LOCAL...");
    _socketSecret = randomBytes(32).toString('hex');

    const app = express();
    app.use(express.json());

    // Middleware de Rate Limiting Global (Servidor Local)
    const rateLimit = await import('express-rate-limit');
    const globalLimiter = rateLimit.default({
        windowMs: 15 * 60 * 1000,
        max: 300,
        message: "Demasiadas peticiones desde esta IP (Local)."
    });
    app.use(globalLimiter);

    // CORS: cualquier origen localhost (puerto dinámico); Vary:Origin para evitar problemas de caché
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin && ALLOWED_ORIGINS_LOCAL.test(origin)) {
            res.header("Access-Control-Allow-Origin", origin);
            res.header("Vary", "Origin");
        }
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (req.method === "OPTIONS") return res.sendStatus(204);
        next();
    });

    // Health Check local
    app.get("/", (req, res) => {
        res.status(200).send("Servidor Ravage (Local) está activo.");
    });

    /* --- PLANTILLA HTTPS (COMENTADA) ---
    // Para activar HTTPS, genera certificados (ej: openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes)
    // y colócalos en una carpeta 'certs' en la raíz del backend.

    // const httpsOptions = {
    //     key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'key.pem')),
    //     cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'cert.pem'))
    // };

    // const server = https.createServer(httpsOptions, app);
    -------------------------------------- */

    // Servidor HTTP actual
    const server = http.createServer(app);

    /* SOCKET.IO DEL BUZON DE USUARIO */
    io = new Server(server, {
        cors: {
            origin: ALLOWED_ORIGINS_LOCAL,
            methods: ["GET", "POST"]
        },
    });

    // Solo se permiten conexiones que presenten el token secreto generado al arrancar
    io.use((socket, next) => {
        if (socket.handshake.auth?.token === _socketSecret) return next();
        log.warn({ socketId: socket.id }, 'Conexión Socket.IO rechazada: token inválido');
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

    // Puerto 0 → el SO asigna el primer puerto libre disponible
    await new Promise((resolve, reject) => {
        appServer = server.listen(0, () => resolve());
        appServer.once('error', reject);
    });
    const PORT = appServer.address().port;
    log.info({ port: PORT, protocol: 'http' }, 'Servidor Express + Socket.IO activo');
    return io;
}

function stopServer() {
    if (appServer) appServer.close(() => log.warn("Servidor local cerrado"));
}

export { startServer, stopServer, io };