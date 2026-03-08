import { BuzonUsuarios } from "./mongo.js"; // tu colección ya conectada

export async function iniciarBuzon(io) {
    const changeStream = BuzonUsuarios.watch(); // observa todos los cambios

    changeStream.on("change", (change) => {
        console.log("Cambio detectado:", change);
        io.emit("nueva-notificacion", change); // envía al renderer
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