import { BuzonUsuarios } from '../db/mongo.js'; // tu colección ya conectada
//TODO: terminar
export async function iniciarBuzon(io, mainWindow) {
    console.log("buzon iniciado")
    const changeStream = BuzonUsuarios.watch([], { fullDocument: "updateLookup" });

    changeStream.on("change", (change) => {
        const userId = change.documentKey._id;
        const doc = change.fullDocument;
        // Enviar al socket (otros clientes si los hubiera), pero en este caso solo tiene un id
        io.to(userId).emit("nueva-notificacion", doc);
        // Enviar a tu renderer de la ventana principal
        if (mainWindow) {
            mainWindow.webContents.send("nueva-notificacion", doc);
        }

    });
    changeStream.on("error", (err) => {
        console.error("Error en Change Stream:", err);
    });
    /* para mandar solo notificaciones sobre cosas especificas
    changeStream.on("change", (change) => {
        if (change.operationType === "insert") {
            io.emit("nueva-notificacion", change.fullDocument);
        }
    });
    */
}