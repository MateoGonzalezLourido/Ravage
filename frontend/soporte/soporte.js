const parte_id_seccion_completa = "seccion-completa-"//+ el id de la seccion
const clase_mini_seccion = "seccion-menu-soporte"

function cerrar_mini_secciones(accion) {
    if (!accion) {//mostrar
        document.getElementById("conjunto-secciones").classList.remove("ocultar-display")
        document.getElementById("conjunto-secciones").classList.add("flex-display")
    }
    else {
        document.getElementById("conjunto-secciones").classList.remove("flex-display")
        document.getElementById("conjunto-secciones").classList.add("ocultar-display")

    }
}
function cerrar_secciones(accion) {
    if (!accion) {//mostrar
        document.querySelector(".seccion-completa").forEach(sec => {
            sec.classList.remove("ocultar-display")
            sec.classList.add("flex-display")
        })
    }
    else {
        document.querySelector(".seccion-completa").forEach(sec => {
            sec.classList.remove("flex-display")
            sec.classList.add("ocultar-display")
        })
    }
}
document.getElementById("bt-volver").addEventListener("click", () => {
    cerrar_secciones(true)
    cerrar_mini_secciones(false)
})
document.querySelectorAll(`.${clase_mini_seccion}`).forEach(sec => {
    sec.addEventListener("click", () => {
        cerrar_mini_secciones(true)
        //cojer el id y hacer que se muestre
        const id_completo = parte_id_seccion_completa + sec.id
        document.getElementById(`${id_completo}`).classList.remove("ocultar-display")
        document.getElementById(`${id_completo}`).classList.add("flex-display")
    })
});