// backend/services/users.js
const { getDB } = require('../db/mongo.js')
const bcrypt = require('bcryptjs')
const { saveSession, readSession, clearSession, generateToken, validateToken } = require('./controladorArchivosSesion.js')

const COLLECTION = 'users'

async function AUTO_LOGIN_USUARIO() {
    //leer fichero con datos de sesion anterior
    const data = readSession()
    //verificar si son legitimos los datos
    if (!data) return false; //fichero vacio
    if (data.indexOf("@") == -1) return false; //no es un correo
    const resultado = comprobaciones_Username(data.username)
    if (!resultado.res) return false
    const username = validateToken(session.token);
    if (!username) {
        clearSession(); // token inválido → limpiar sesión
        return false;
    }
    //TODO: verificar si esa cuenta sigue existiendo en la base de datos

}
//TODO:
async function registerUsuario(username, password) {
    const resultado = comprobaciones_Username(data.username)
    if (!resultado.res) return { success: false, message: resultado.mes }
    const db = getDB();
    const hashed = await bcrypt.hash(password, 10);
    const user = { username, password: hashed };
    await db.collection(COLLECTION).insertOne(user);
    return { success: true, username };
}
//TODO:
function comprobaciones_Username() {

}
//TODO:
async function loginUsuario(username, password) {
    const resultado = comprobaciones_Username(data.username)
    if (!resultado.res) return { success: false, message: resultado.mes }
    const db = getDB();
    const user = await db.collection(COLLECTION).findOne({ username });
    if (!user) return { success: false, message: 'Usuario no encontrado' }

    const valid = await bcrypt.compare(password, user.password);
    //JWT 
    const token = generateToken(username);
    saveSession(username, token)// guardamos token en JSON
    return { success: true }
}

async function cerrarSesionUsuario(username, password) {
    clearSession()
    console.log("Sesion cerrada")
}
module.exports = { registerUsuario, loginUsuario, AUTO_LOGIN_USUARIO }
