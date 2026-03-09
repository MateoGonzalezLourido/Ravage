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

    /*SOCKET.IO DEL BUZON DE USUARIO */
    // iniciar socket.io sobre el servidor HTTP
    io = new Server(server, {
        cors: {
            origin: "*", // ajustar según frontend
        },
    });

    //de evento socket
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