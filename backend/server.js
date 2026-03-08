import express from "express";
import { Server } from "socket.io";
import http from "http";

let appServer;
let io;

async function startServer() {
    console.log("- Iniciando servidor...");

    const app = express();
    app.use(express.json());

    const PORT = 3000;

    // crear HTTP server a partir de Express
    const server = http.createServer(app);

    // iniciar socket.io sobre el servidor HTTP
    io = new Server(server, {
        cors: {
            origin: "*", // ajustar según frontend
        },
    });

    // ejemplo de evento socket
    io.on("connection", (socket) => {
        console.log("Cliente conectado:", socket.id);
        socket.on("mensaje", (msg) => console.log("Mensaje recibido:", msg));
    });

    // levantar server
    appServer = server.listen(PORT, () =>
        console.log(`*Servidor Express + Socket.IO en http://localhost:${PORT}`)
    );
    return io
}

function stopServer() {
    if (appServer) appServer.close(() => console.warn("*Servidor cerrado"));
}

export { startServer, stopServer, io };