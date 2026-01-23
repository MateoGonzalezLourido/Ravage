/*Mostrar o no el Login, al iniciar la app */
if (window.boot.isLogged) {
    document.querySelector("#seccion-login").classList.remove("flex-display")
    document.querySelector("#seccion-registro-login").classList.add("ocultar-display")
} else {
    document.querySelector("#seccion-registro").classList.remove("ocultar-display")
    document.querySelector("#seccion-registro-login").classList.add("flex-display")
}

//cambio entre login y registro
document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("#bt-cambiar-registro").addEventListener("click", () => {
        document.querySelector("#seccion-login").classList.remove("flex-display")
        document.querySelector("#seccion-login").classList.add("ocultar-display")

        document.querySelector("#seccion-registro").classList.remove("ocultar-display")
        document.querySelector("#seccion-registro").classList.add("flex-display")

    })
    document.querySelector("#bt-cambiar-login").addEventListener("click", () => {
        document.querySelector("#seccion-registro").classList.remove("flex-display")
        document.querySelector("#seccion-registro").classList.add("ocultar-display")

        document.querySelector("#seccion-login").classList.remove("ocultar-display")
        document.querySelector("#seccion-login").classList.add("flex-display")
    })
    document.querySelector("#form-login").addEventListener("submit", () => {
        const username = document.querySelector('#login-user').value
        const password = document.querySelector('#login-pass').value

        //TODO: backend
        const result = fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        })
        alert(result.success ? `Bienvenido ${result.username}` : result.message)
    })
    document.querySelector("#form-registro").addEventListener('submit', async (e) => {
        e.preventDefault()
        const username = document.querySelector('#registro-user').value
        const password = document.querySelector('#registro-pass').value
        const password_confirm = document.querySelector('#registro-pass-confirm').value

        if (!(password === password_confirm)) {//las dos contrtaseñas son diferentes
            document.querySelector("#registro-pass-confirm").classList.add("estrada-menu-registro-login-incorrecto")
            document.querySelector("#span-repetir-contraseña").classList.add("estrada-menu-registro-login-incorrecto")
            return;
        }
        document.querySelector("#registro-pass-confirm").classList.remove("estrada-menu-registro-login-incorrecto")
        document.querySelector("#span-repetir-contraseña").classList.remove("estrada-menu-registro-login-incorrecto")

        //TODO: backend
        const result = await window.api.register(username, password)
        alert(result.success ? `Usuario ${result.username} creado` : result.message)
    })
})