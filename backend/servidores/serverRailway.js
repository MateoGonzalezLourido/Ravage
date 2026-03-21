import { express, Server, http } from "../utils/libs.js";
import { connectDB } from "../db/mongo.js";


let appServer;
let io;

/**
 * Inicia el servidor optimizado para despliegue en Railway.
 * Maneja el puerto dinámico y expone un endpoint de salud.
 */
async function startServer() {
    console.log("- Iniciando servidor en modo PRODUCCIÓN (Railway)...");

    const app = express();
    app.use(express.json());

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
        console.log("Cliente conectado:", socket.id);

        socket.on("identificar", (userId) => {
            socket.join(userId);
            socket.userId = userId;
            console.log("Usuario conectado:", userId);
        });

        socket.on("disconnect", () => {
            if (socket.userId) {
                console.log("Usuario desconectado:", socket.userId);
            }
        });
    });

    // Levantamos el servidor escuchando en todas las interfaces (0.0.0.0)
    appServer = server.listen(PORT, '0.0.0.0', () => {
        console.log(`* Servidor Express + Socket.IO desplegado en puerto ${PORT}`);
    });


    return io;
}

function stopServer() {
    if (appServer) {
        appServer.close(() => console.warn("* Servidor de producción cerrado"));
    }
}

// Lógica para permitir ejecución directa (para Railway)
if (process.argv[1]?.includes('serverRailway.js')) {
    (async () => {
        try {
            await connectDB();
            await startServer();
        } catch (error) {
            console.error("Error al iniciar el servidor en Railway:", error);
            process.exit(1);
        }
    })();
}

export { startServer, stopServer, io };