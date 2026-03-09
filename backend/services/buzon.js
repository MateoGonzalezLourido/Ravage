import { BuzonUsuarios } from '../db/mongo.js'; // tu colección ya conectada
//TODO: terminar
export async function iniciarBuzon(io) {
    const changeStream = BuzonUsuarios.watch();

    changeStream.on("change", (change) => {

        const userId = change.documentKey._id;

        io.to(userId).emit("nueva-notificacion");

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