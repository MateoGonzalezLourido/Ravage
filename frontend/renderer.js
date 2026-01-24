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

        //TODO:conectar con backend
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

        if (result.success) {//datos validos: validar codigo de correo
            document.querySelector("#seccion-login").classList.remove("flex-display")
            document.querySelector("#seccion-login").classList.add("ocultar-display")

            document.querySelector("#seccion-registro").classList.remove("flex-display")
            document.querySelector("#seccion-registro").classList.add("ocultar-display")

            document.querySelector("#seccion-validacion-codigo-correo").classList.remove("ocultar-display")
            document.querySelector("#seccion-validacion-codigo-correo").classList.add("flex-display")
            document.querySelector("#bt-cambiar-login-validation-code").addEventListener("click", () => {
                document.querySelector("#seccion-validacion-codigo-correo").classList.remove("flex-display")
                document.querySelector("#seccion-validacion-codigo-correo").classList.add("ocultar-display")

                document.querySelector("#seccion-registro").classList.remove("ocultar-display")
                document.querySelector("#seccion-registro").classList.add("flex-display")
            })
            document.querySelector("#form-validation-correo").addEventListener('submit', async (e) => {
                e.preventDefault()
                const codigo = document.querySelector("#bt-code-introducir").value
                result = await window.sesion_usuario.VALIDAR_CODE_REGISTRAR_USUARIO(username, codigo);
                console.log("xdata:", result)
                if (result.success) {//codigo valido
                    console.log("SE HA CREADO EL USUARIO CORRECTAMENTE")
                    //mostrar menu de confirmacion cuenta creada
                    document.querySelector("#seccion-validacion-codigo-correo").classList.remove("flex-display")
                    document.querySelector("#seccion-validacion-codigo-correo").classList.add("ocultar-display")

                    document.querySelector("#seccion-confirmacion-cuenta-creada").classList.remove("ocultar-display")
                    document.querySelector("#seccion-confirmacion-cuenta-creada").classList.add("flex-display")

                    document.querySelector("#bt-volver-login-confirmacion-cuenta").addEventListener("click", () => {
                        document.querySelector("#seccion-confirmacion-cuenta-creada").classList.remove("flex-display")
                        document.querySelector("#seccion-confirmacion-cuenta-creada").classList.add("ocultar-display")

                        document.querySelector("#seccion-login").classList.remove("ocultar-display")
                        document.querySelector("#seccion-login").classList.add("flex-display")
                    })
                }
                else {//TODO:mostrar errores en el html
                    console.log("NO SE HA CREADO EL USUARIO CORRECTAMENTE")

                }
            })
        }
        else {//TODO:mostrar errores en el html

        }

    })
})