//No mostrar el login si este ya tiene sesion iniciada con autolog
async function preload_pag() {
    if (window.boot.isLogged) {
        await window.paginas_app.CAMBIAR_PAGINA_HOME()//mandar al home
    } else {
        mostrar_menu_sesion(true)
    }
}
preload_pag()
//animaciones
function mostrar_menu_sesion(accion) {
    if (!accion) {//0: esconder, 1: mostrar
        document.querySelector("#seccion-registro-login").classList.remove("flex-display")
        document.querySelector("#seccion-registro-login").classList.add("ocultar-display")
    } else {
        document.querySelector("#seccion-registro-login").classList.remove("ocultar-display")
        document.querySelector("#seccion-registro-login").classList.add("flex-display")
        document.querySelector("#login-user").focus()
    }
}
function mostrar_menu_log(accion) {
    if (!accion) {
        document.querySelector("#seccion-login").classList.remove("flex-display")
        document.querySelector("#seccion-login").classList.add("ocultar-display")
    }
    else {
        document.querySelector("#seccion-login").classList.remove("ocultar-display")
        document.querySelector("#seccion-login").classList.add("flex-display")
        document.querySelector("#login-user").focus()
    }
}
function mostrar_menu_reg(accion) {
    if (!accion) {
        document.querySelector("#seccion-registro").classList.remove("flex-display")
        document.querySelector("#seccion-registro").classList.add("ocultar-display")
    }
    else {
        document.querySelector("#seccion-registro").classList.remove("ocultar-display")
        document.querySelector("#seccion-registro").classList.add("flex-display")
        document.querySelector("#registro-apodo").focus()
    }
}
function mostrar_menu_validation_code(accion) {
    if (!accion) {
        document.querySelector("#seccion-validacion-codigo-correo").classList.remove("flex-display")
        document.querySelector("#seccion-validacion-codigo-correo").classList.add("ocultar-display")
    }
    else {
        document.querySelector("#seccion-validacion-codigo-correo").classList.remove("ocultar-display")
        document.querySelector("#seccion-validacion-codigo-correo").classList.add("flex-display")
        document.querySelector("#bt-code-introducir").focus()
    }
}
function mostrar_menu_cuenta_creada(accion) {
    if (!accion) {
        document.querySelector("#seccion-confirmacion-cuenta-creada").classList.remove("flex-display")
        document.querySelector("#seccion-confirmacion-cuenta-creada").classList.add("ocultar-display")
    }
    else {
        document.querySelector("#seccion-confirmacion-cuenta-creada").classList.remove("ocultar-display")
        document.querySelector("#seccion-confirmacion-cuenta-creada").classList.add("flex-display")
        document.querySelector("#bt-volver-login-confirmacion-cuenta").focus()
    }
}

document.addEventListener("DOMContentLoaded", () => {
    //cambiar login a registro
    document.querySelector("#bt-cambiar-registro").addEventListener("click", () => {
        mostrar_menu_log(false)
        mostrar_menu_reg(true)
    })
    //cambiar registro a login
    document.querySelector("#bt-cambiar-login").addEventListener("click", () => {
        mostrar_menu_reg(false)
        mostrar_menu_log(true)
    })
    //login
    document.querySelector("#form-login").addEventListener("submit", async (e) => {

        e.preventDefault()
        const username = document.querySelector('#login-user').value.trim()
        const password = document.querySelector('#login-pass').value.trim()
        const mantener_sesion_iniciada = document.querySelector("#login-guardar").checked

        //TODO:conectar con backend
        let result = await window.sesion_usuario.LOGIN_USUARIO(username, password, mantener_sesion_iniciada)

        if (result.success) {//sesion iniciada
            if (result.autoverificacion) {//sesion iniciada sin codigo de verificacion
                console.log("SE HA INICIADO SESION CORRECTAMENTE")
                await window.paginas_app.CAMBIAR_PAGINA_HOME()//mandar al home
            }
            else {
                mostrar_menu_log(false)
                mostrar_menu_reg(false)
                mostrar_menu_validation_code(true)

                document.querySelector("#bt-cambiar-login-validation-code").addEventListener("click", () => {
                    e.preventDefault()
                    mostrar_menu_validation_code(false)
                    mostrar_menu_log(true)
                })
                document.querySelector("#form-validation-correo").addEventListener('submit', async (e) => {
                    e.preventDefault()
                    const codigo = document.querySelector("#bt-code-introducir").value
                    if (codigo.length <= 6) result = await window.sesion_usuario.VALIDAR_CODE_LOGIN_USUARIO(username, codigo);
                    else result = { success: false, message: "Código muy largo" }

                    if (result.success) {//codigo valido
                        console.log("SE HA INICIADO SESION CORRECTAMENTE")
                        //mostrar menu de confirmacion cuenta creada
                        mostrar_menu_validation_code(false)
                        await window.paginas_app.CAMBIAR_PAGINA_HOME()//mandar al home

                        document.querySelector("#bt-volver-login-confirmacion-cuenta").addEventListener("click", () => {
                            e.preventDefault()
                            mostrar_menu_sesion(false)
                            window.sesion_usuario.BORRAR_CODES_VALIDACION_CORREO(username)
                        })
                    }
                    else {//TODO:mostrar errores en el html
                        if (result.bloqueador) return;
                        console.error("NO SE HA INICIADO SESION CORRECTAMENTE")
                        document.querySelector("#text-error-form-causa-codigo-validar").innerHTML = "*" + result.message + "*"
                        document.querySelector("#text-error-form-causa-codigo-validar").classList.remove("ocultar-display")
                        document.querySelector("#text-error-form-causa-codigo-validar").classList.add("flex-display")
                    }
                })
            }
        }
        else {//TODO: mostrar errores en el html
            if (result.bloqueador) return;
            console.error("FALLO AL INICIO DEL LOGIN")
            document.querySelector("#text-error-form-causa-login").innerHTML = "*" + result.message + "*"
            document.querySelector("#text-error-form-causa-login").classList.remove("ocultar-display")
            document.querySelector("#text-error-form-causa-login").classList.add("flex-display")
        }
    })
    //login-pagina soporte cambiar
    document.querySelector("#bt-cambiar-contraseña-login").addEventListener("click", (e) => {
        e.stopPropagation()
        window.paginas_app.CAMBIAR_PAGINA_SOPORTE()//cambiar a pagina de soporte
    })
    //registro
    document.querySelector("#form-registro").addEventListener('submit', async (e) => {
        e.preventDefault()
        let apodo = document.querySelector('#registro-apodo').value.trim()
        const username = document.querySelector('#registro-user').value.trim()
        const password = document.querySelector('#registro-pass').value.trim()
        const password_confirm = document.querySelector('#registro-pass-confirm').value.trim()
        if (!(password === password_confirm)) {//las dos contraseñas son diferentes
            document.querySelector("#registro-pass-confirm").classList.add("estrada-menu-registro-login-incorrecto")
            document.querySelector("#span-repetir-contraseña").classList.add("estrada-menu-registro-login-incorrecto")
            return;
        }
        document.querySelector("#registro-pass-confirm").classList.remove("estrada-menu-registro-login-incorrecto")
        document.querySelector("#span-repetir-contraseña").classList.remove("estrada-menu-registro-login-incorrecto")

        //Conectar con backend
        let result = await window.sesion_usuario.REGISTRAR_USUARIO(apodo, username, password);

        if (result.success) {//datos validos: validar codigo de correo
            mostrar_menu_log(false)
            mostrar_menu_reg(false)

            mostrar_menu_validation_code(true)
            document.querySelector("#bt-cambiar-login-validation-code").addEventListener("click", () => {
                e.preventDefault()
                mostrar_menu_validation_code(false)
                mostrar_menu_reg(true)
                window.sesion_usuario.BORRAR_CODES_VALIDACION_CUENTA(username)
            })
            document.querySelector("#form-validation-correo").addEventListener('submit', async (e) => {
                e.preventDefault()
                const codigo = document.querySelector("#bt-code-introducir").value
                if (codigo.length <= 6) result = await window.sesion_usuario.VALIDAR_CODE_REGISTRAR_USUARIO(username, codigo);
                else result = { success: false, message: "Código muy largo" }

                if (result.success) {//codigo valido
                    console.log("SE HA CREADO EL USUARIO CORRECTAMENTE")
                    //mostrar menu de confirmacion cuenta creada
                    mostrar_menu_validation_code(false)
                    mostrar_menu_cuenta_creada(true)

                    document.querySelector("#bt-volver-login-confirmacion-cuenta").addEventListener("click", () => {
                        e.preventDefault()
                        mostrar_menu_cuenta_creada(false)
                        mostrar_menu_log(true)
                    })
                }
                else {//TODO:mostrar errores en el html
                    console.error("NO SE HA CREADO EL USUARIO CORRECTAMENTE")

                }
            })
        }
        else {//TODO:mostrar errores en el html
            if (result.bloqueador) return;
            console.log("ERROR AL REGISTRAR USUARIO")
            document.querySelector("#text-error-form-causa-registro").innerHTML = "*" + result.message + "*"
            document.querySelector("#text-error-form-causa-registro").classList.remove("ocultar-display")
            document.querySelector("#text-error-form-causa-registro").classList.add("flex-display")
        }
    })
})