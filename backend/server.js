const express = require('express');
const { connectDB } = require('./db/mongo.js');

let appServer; // para poder cerrar el server si quieres

async function startServer() {
    console.log('-Iniciando servidor...');

    await connectDB(); // conecta Mongo
    console.log('*DB lito para usar:');

    const app = express(); // <--- aquí defines app
    app.use(express.json());

    const PORT = 3000;//puerto de escucha del servidor
    //levantar servidor localhost
    appServer = app.listen(PORT, () => console.log(`*Servidor Express en http://localhost:${PORT}`));
}

// Función opcional para cerrar el servidor
function stopServer() {
    if (appServer) appServer.close(() => console.log('*Servidor cerrado'));
}

module.exports = { startServer, stopServer };