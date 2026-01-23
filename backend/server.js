
const express = require('express');
const { connectDB, getDB } = require('./db/mongo.js');
const { login, register } = require('./services/users.js');

let appServer; // para poder cerrar el server si quieres

module.exports = { startServer, stopServer };

async function startServer() {
    console.log('-Iniciando servidor...');

    await connectDB(); // conecta Mongo
    const db = getDB();
    console.log('*DB lista para usar:', db.databaseName);

    const app = express(); // <--- aquí defines app
    app.use(express.json());

    // Rutas
    app.post('/login', async (req, res) => {
        const { username, password } = req.body;
        const result = await login(username, password);
        res.json(result);
    });

    app.post('/register', async (req, res) => {
        const { username, password } = req.body;
        const result = await register(username, password);
        res.json(result);
    });

    const PORT = 3000;
    appServer = app.listen(PORT, () => console.log(`*Servidor Express en http://localhost:${PORT}`));
}

// Función opcional para cerrar el servidor
function stopServer() {
    if (appServer) appServer.close(() => console.log('*Servidor cerrado'));
}
