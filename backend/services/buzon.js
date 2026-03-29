import { BuzonUsuarios } from '../models/Buzon.js';
import { getIDMongodbUsuario } from '../STORAGE/Variables_sesion.js';
let changeStream = null;

//TODO: terminar
export async function iniciarBuzon(io, mainWindow) {
    if (changeStream) {
        await detenerBuzon();
    }

    console.log("buzon iniciado")
    changeStream = BuzonUsuarios.watch([], { fullDocument: "updateLookup" });

    changeStream.on("change", (change) => {
        const userId = change.documentKey._id;
        const myUserId = getIDMongodbUsuario();
        
        // Evita enviar entradas del buzón de otros usuarios a nuestra ventana principal
        if (!myUserId || userId.toString() !== myUserId.toString()) return;

        const doc = change.fullDocument;
        // Enviar al socket (otros clientes si los hubiera), pero en este caso solo tiene un id
        io.to(userId.toString()).emit("nueva-notificacion", doc);
        // Enviar a tu renderer de la ventana principal
        if (mainWindow) {
            mainWindow.webContents.send("nueva-notificacion", doc);
        }

    });
    changeStream.on("error", (err) => {
        // Ignore the error if the stream is being closed deliberately
        if (err.name === 'MongoClientClosedError') return;
        console.error("Error en Change Stream:", err);
    });
}

export async function detenerBuzon() {
    if (changeStream) {
        try {
            await changeStream.close();
            changeStream = null;
            console.log("buzon detenido")
        } catch (err) {
            console.error("Error al detener el buzon:", err);
        }
    }
}