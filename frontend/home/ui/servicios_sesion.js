export function manejar_ui_cierre_sesion(mostrar) {
    const clase_sync_bar = "sync-mailbox-bar"
    if (mostrar) {
        if (!document.querySelector(`.${clase_sync_bar}`)) {
            const syncBar = document.createElement("div")
            syncBar.className = clase_sync_bar
            syncBar.innerHTML = `<div class="sync-spinner"></div><span>Cerrando sesión...</span>`
            document.body.appendChild(syncBar)
            requestAnimationFrame(() => syncBar.classList.add("visible"))
        }
    } else {
        const bar = document.querySelector(`.${clase_sync_bar}`)
        if (bar) {
            bar.classList.remove("visible")
            setTimeout(() => bar.remove(), 450)
        }
    }
}
