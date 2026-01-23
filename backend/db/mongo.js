const { MongoClient, ServerApiVersion } = require('mongodb')
require('dotenv').config();
// URL de conexión (Atlas)
const uri = process.env.URI_MONGODB;

module.exports = { connectDB, getDB, closeDB }

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
})
let db;
async function connectDB() {
    try {
        await client.connect()
        db = client.db() // usa la DB de tu URI o pon .db('nombreDB')
        console.log('-Conectado a MongoDB')
        return db
    } catch (err) {
        console.error('-Error conectando a MongoDB:', err)
        throw err
    }
}
function getDB() {
    if (!db) throw new Error('-DB no conectada todavía')
    return db
}

// Opcional: cerrar al salir de la app
async function closeDB() {
    if (client) await client.close()
}
