import { express, Server, http } from "../utils/libs.js";

let appServer;
let io;

async function startServer() {
    console.log("- Iniciando servidor...");

    const app = express();
    app.use(express.json());

    const PORT = process.env.PORT || 8080;

    const server = http.createServer(app);

    io = new Server(server, {
        cors: {
            origin: "*",
        },
    });

    io.on("connection", (socket) => {

        console.log("Cliente conectado:", socket.id);

        socket.on("identificar", (userId) => {
            socket.join(userId);
            socket.userId = userId;
            console.log("Usuario conectado:", userId);
        });

        socket.on("disconnect", () => {
            console.log("Usuario desconectado:", socket.userId);
        });

    });

    appServer = server.listen(PORT, () =>
        console.log(`Servidor iniciado en puerto ${PORT}`)
    );

    return io;
}

function stopServer() {
    if (appServer) {
        appServer.close(() => console.warn("*Servidor cerrado"));
    }
}

export { startServer, stopServer, io };