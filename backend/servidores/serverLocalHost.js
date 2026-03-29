import { express, Server, http, __dirname } from "../utils/libs.js";
import { createLogger } from '../utils/logger.js';
const log = createLogger('server-local');
//import { https, fs, path } from "../utils/libs.js";

let appServer;
let io;

/**
 * Inicia el servidor optimizado para desarrollo local.
 */
async function startServer() {
    log.info("Iniciando servidor LOCAL...");

    const app = express();
    app.use(express.json());

    // Configuración de CORS para desarrollo local (más flexible pero controlada)
    app.use((req, res, next) => {
        const allowedOrigins = ["http://localhost:3000", "http://localhost:8080", "file://"];
        const origin = req.headers.origin;
        if (allowedOrigins.includes(origin) || !origin) {
            res.header("Access-Control-Allow-Origin", origin || "*");
        }
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        next();
    });

    const PORT = 3000;

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
            origin: ["http://localhost:3000", "http://localhost:8080"],
            methods: ["GET", "POST"]
        },
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

    appServer = server.listen(PORT, () =>
        log.info({ port: PORT, protocol: 'http' }, `Servidor Express + Socket.IO activo`)
    );
    return io;
}

function stopServer() {
    if (appServer) appServer.close(() => log.warn("Servidor local cerrado"));
}

export { startServer, stopServer, io };