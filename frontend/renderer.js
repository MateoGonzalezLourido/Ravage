/*Mostrar o no el Login, al iniciar la app */
if (window.boot.isLogged) {
    document.querySelector("#seccion-registro-login").classList.remove("flex-display")
    document.querySelector("#seccion-registro-login").classList.add("ocultar-display")
} else {
    document.querySelector("#seccion-registro-login").classList.remove("ocultar-display")
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
        const apodo = document.querySelector('#registro-apodo').value
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
        let result = await window.sesion_usuario.REGISTRAR_USUARIO(apodo, username, password);
        if (result) {//datos validos: validar codigo de correo
            document.querySelector("#seccion-login").classList.remove("flex-display")
            document.querySelector("#seccion-login").classList.add("ocultar-display")

            document.querySelector("#seccion-registro").classList.remove("flex-display")
            document.querySelector("#seccion-registro").classList.add("ocultar-display")

            document.querySelector("#seccion-validacion-codigo-correo").classList.remove("ocultar-display")
            document.querySelector("#seccion-validacion-codigo-correo").classList.add("flex-display")
            document.querySelector("#form-validation-correo").addEventListener("submit", async () => {
                const codigo = document.querySelector("#bt-code-introducir").value
                result = await window.sesion_usuario.VALIDAR_CODE_REGISTRAR_USUARIO(username, codigo);
                if (result.success) {//codigo valido
                    console.log("SE HA CREADO EL USUARIO CORRECTAMENTE")
                }
            })
        }

    })
})