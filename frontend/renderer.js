//No mostrar el login si este ya tiene sesion iniciada con autolog
if (window.boot.isLogged) {
    cambiar_menu_inicio_apodo()
    mostrar_menu_sesion(false)
} else {
    mostrar_menu_sesion(true)
}
async function cambiar_menu_inicio_apodo() {
    const apodo = await window.sesion_usuario.GET_APODO_SESION()
    document.querySelector("#text-apodo-usuario-menu-inicio").innerHTML = apodo
}
//animaciones
function mostrar_menu_sesion(accion) {
    if (!accion) {//0: esconder, 1: mostrar
        document.querySelector("#seccion-registro-login").classList.remove("flex-display")
        document.querySelector("#seccion-registro-login").classList.add("ocultar-display")
    } else {
        document.querySelector("#seccion-registro-login").classList.remove("ocultar-display")
        document.querySelector("#seccion-registro-login").classList.add("flex-display")
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
                mostrar_menu_sesion(false)
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
                        cambiar_menu_inicio_apodo()
                        mostrar_menu_validation_code(false)
                        mostrar_menu_cuenta_creada(true)

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
    //login-cambiar contraseña
    document.querySelector("#bt-cambiar-contraseña-login").addEventListener("click", (e) => {
        e.stopPropagation()
        
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
    //ajustes
    document.querySelector("#bt-seccion-menu-cuenta-ajustes").addEventListener("click", (e) => {
        e.preventDefault()
        //mostrar menu de ajustes
        document.querySelector("#seccion-menu-cuenta-ajustes").classList.remove("ocultar-display")
        document.querySelector("#seccion-menu-cuenta-ajustes").classList.add("block-display")
        //cambios de seccion
        function cerrar_cuerpos_ajustes(no_cerrar) {
            if (no_cerrar == "cuenta") {
                document.querySelector("#cuerpo-ajustes-cuenta").classList.remove("ocultar-display")
                document.querySelector("#cuerpo-ajustes-cuenta").classList.add("flex-display")
            }
            else {
                document.querySelector("#cuerpo-ajustes-cuenta").classList.remove("flex-display")
                document.querySelector("#cuerpo-ajustes-cuenta").classList.add("ocultar-display")
            }
            if (no_cerrar == "general") {
                document.querySelector("#cuerpo-ajustes-general").classList.remove("ocultar-display")
                document.querySelector("#cuerpo-ajustes-general").classList.add("flex-display")
            }
            else {
                document.querySelector("#cuerpo-ajustes-general").classList.remove("flex-display")
                document.querySelector("#cuerpo-ajustes-general").classList.add("ocultar-display")
            }
            if (no_cerrar == "notificaciones") {
                document.querySelector("#cuerpo-ajustes-noti").classList.remove("ocultar-display")
                document.querySelector("#cuerpo-ajustes-noti").classList.add("flex-display")
            }
            else {
                document.querySelector("#cuerpo-ajustes-noti").classList.remove("flex-display")
                document.querySelector("#cuerpo-ajustes-noti").classList.add("ocultar-display")
            }
            if (no_cerrar == "soporte") {
                document.querySelector("#cuerpo-ajustes-soporte").classList.remove("ocultar-display")
                document.querySelector("#cuerpo-ajustes-soporte").classList.add("flex-display")
            }
            else {
                document.querySelector("#cuerpo-ajustes-soporte").classList.remove("flex-display")
                document.querySelector("#cuerpo-ajustes-soporte").classList.add("ocultar-display")
            }
            if (no_cerrar == "saber mas") {
                document.querySelector("#cuerpo-ajustes-saber").classList.remove("ocultar-display")
                document.querySelector("#cuerpo-ajustes-saber").classList.add("flex-display")
            }
            else {
                document.querySelector("#cuerpo-ajustes-saber").classList.remove("flex-display")
                document.querySelector("#cuerpo-ajustes-saber").classList.add("ocultar-display")
            }
            //mover al inicio de los ajustes
        }
        function cambiar_ajustes_cuenta(e) {
            e.preventDefault()
            cerrar_cuerpos_ajustes("cuenta")
            document.querySelector("#cuerpo-ajustes-cuenta").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
        function cambiar_ajustes_general(e) {
            e.preventDefault()
            cerrar_cuerpos_ajustes("general")
            document.querySelector("#cuerpo-ajustes-general").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
        function cambiar_ajustes_noti(e) {
            e.preventDefault()
            cerrar_cuerpos_ajustes("notificaciones")
            document.querySelector("#cuerpo-ajustes-noti").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
        function cambiar_ajustes_soporte(e) {
            e.preventDefault()
            cerrar_cuerpos_ajustes("soporte")
            document.querySelector("#cuerpo-ajustes-soporte").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
        function cambiar_ajustes_saber(e) {
            e.preventDefault()
            cerrar_cuerpos_ajustes("saber mas")
            document.querySelector("#cuerpo-ajustes-saber").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
        document.querySelector("#bt-menu-navegacion-ajustes-cuenta").addEventListener("click", cambiar_ajustes_cuenta)
        document.querySelector("#bt-menu-navegacion-ajustes-general").addEventListener("click", cambiar_ajustes_general)
        document.querySelector("#bt-menu-navegacion-ajustes-noti").addEventListener("click", cambiar_ajustes_noti)
        document.querySelector("#bt-menu-navegacion-ajustes-soporte").addEventListener("click", cambiar_ajustes_soporte)
        document.querySelector("#bt-menu-navegacion-ajustes-saber").addEventListener("click", cambiar_ajustes_saber)
        //cerrar ajustes
        function cerrar_ajustes_pagina(e) {
            e.preventDefault()
            //cerrar menu de ajustes
            document.querySelector("#seccion-menu-cuenta-ajustes").classList.remove("block-display")
            document.querySelector("#seccion-menu-cuenta-ajustes").classList.add("ocultar-display")
            //quitar eventos
            document.querySelector("#bt-menu-navegacion-ajustes-cuenta").removeEventListener("click", cambiar_ajustes_cuenta)
            document.querySelector("#bt-menu-navegacion-ajustes-general").removeEventListener("click", cambiar_ajustes_general)
            document.querySelector("#bt-menu-navegacion-ajustes-noti").removeEventListener("click", cambiar_ajustes_noti)
            document.querySelector("#bt-menu-navegacion-ajustes-soporte").removeEventListener("click", cambiar_ajustes_soporte)
            document.querySelector("#bt-menu-navegacion-ajustes-saber").removeEventListener("click", cambiar_ajustes_saber)
            document.querySelector("#bt-cerrar-menu-ajustes").removeEventListener("click", cerrar_ajustes_pagina)
            document.querySelector("#bt-cambiar-contraseña").removeEventListener("click", funcion_cambiar_contraseña)

            //reiniciar bloqueadores de span
            bloquear_span_cambio_contraseña = true
        }
        document.querySelector("#bt-cerrar-menu-ajustes").addEventListener("click", cerrar_ajustes_pagina)
        //cerrar sesion
        async function cerrar_sesion_bt(e) {
            e.preventDefault()
            await window.sesion_usuario.CERRAR_SESION()
            //mostrar log
            mostrar_menu_sesion(true)
            mostrar_menu_cuenta_creada(false)
            mostrar_menu_validation_code(false)
            mostrar_menu_reg(false)
            mostrar_menu_log(true)

            document.querySelector("#bt-cerrar-sesion").removeEventListener("click", cerrar_sesion_bt)
        }
        document.querySelector("#bt-cerrar-sesion").addEventListener("click", cerrar_sesion_bt)
        function cambiar_seccion_menu_cambiar_datos_cuenta(tipo) {
            if (tipo == "correo") {
                document.querySelector("#seccion-cambiar-correo-menu").classList.remove("ocultar-display")
                document.querySelector("#seccion-cambiar-correo-menu").classList.add("flex-display")
            }
            else {
                document.querySelector("#seccion-cambiar-correo-menu").classList.remove("flex-display")
                document.querySelector("#seccion-cambiar-correo-menu").classList.add("ocultar-display")
            }
            if (tipo == "contraseña") {
                document.querySelector("#seccion-cambiar-contraseña-menu").classList.remove("ocultar-display")
                document.querySelector("#seccion-cambiar-contraseña-menu").classList.add("flex-display")
            }
            else {
                document.querySelector("#seccion-cambiar-contraseña-menu").classList.remove("flex-display")
                document.querySelector("#seccion-cambiar-contraseña-menu").classList.add("ocultar-display")
            }
            if (tipo == "apodo") {
                document.querySelector("#seccion-cambiar-apodo-menu").classList.remove("ocultar-display")
                document.querySelector("#seccion-cambiar-apodo-menu").classList.add("flex-display")
            }
            else {
                document.querySelector("#seccion-cambiar-apodo-menu").classList.remove("flex-display")
                document.querySelector("#seccion-cambiar-apodo-menu").classList.add("ocultar-display")
            }
        }
        //mostrar menu cambiar contraseña
        let bloquear_span_cambio_contraseña = false
        async function funcion_cambiar_contraseña(e) {
            e.preventDefault()
            if (bloquear_span_cambio_contraseña) {
                //TODO: MOSTRAR NOTIFICACION: "Debes esperar 24h desde la última vez para vovler a cambiar la contraseña"
                return;
            }
            let result = await window.sesion_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ tipo: "contraseña" })
            //si puede mostrar menu de cambio de contraseña
            if (result.success) {
                document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.remove("ocultar-display")
                document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.add("flex-display")
                cambiar_seccion_menu_cambiar_datos_cuenta("contraseña")

                //eventos
                //cambiar contraseña
                async function form_cambio_contraseña(e) {
                    e.preventDefault()
                    const contraseña = document.querySelector("#cambio-pass").value
                    const contraseña_confirmacion = document.querySelector("#cambio-pass-confirm").value
                    //TODO: añadir comprobaciones de validez
                    let valido = true
                    if (contraseña !== contraseña_confirmacion) {
                        valido = false
                        document.querySelector("#cambio-pass-confirm").classList.add("estrada-menu-registro-login-incorrecto")
                        document.querySelector("#span-repetir-contraseña-cambio").classList.add("estrada-menu-registro-login-incorrecto")
                    }

                    document.querySelector("#cambio-pass-confirm").classList.remove("estrada-menu-registro-login-incorrecto")
                    document.querySelector("#span-repetir-contraseña-cambio").classList.remove("estrada-menu-registro-login-incorrecto")
                    if (contraseña.includes(" ")) {
                        valido = false
                        document.querySelector("#text-error-form-causa-cambio-contraseña").classList.remove("ocultar-display")
                        document.querySelector("#text-error-form-causa-cambio-contraseña").classList.add("flex-display")
                        document.querySelector("#text-error-form-causa-cambio-contraseña").innerHTML = "*No puedes usar espacios*"
                    }
                    else if (contraseña.length > 30) {
                        valido = false
                        document.querySelector("#text-error-form-causa-cambio-contraseña").classList.remove("ocultar-display")
                        document.querySelector("#text-error-form-causa-cambio-contraseña").classList.add("flex-display")
                        document.querySelector("#text-error-form-causa-cambio-contraseña").innerHTML = "*Longitud contraseña <=30*"
                    }
                    //hacer el cambio de contraseña(validaciones hechas)
                    if (valido) {//cambiar contraseña
                        result = await window.sesion_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: contraseña, tipo: "contraseña" })

                        if (result && (result.success)) {
                            document.querySelector("#form-cambio-contraseña").removeEventListener("submit", form_cambio_contraseña)

                            //mostrar menu para introducir codigo
                            document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.remove("flex-display")
                            document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.add("ocultar-display")
                            document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.remove("ocultar-display")
                            document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.add("flex-display")

                            //cerrar validacion codigo de contraseña
                            function bt_cerrar_menu(e) {
                                e.preventDefault()
                                //cerrar menu de ajustes
                                document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.remove("flex-display")
                                document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.add("ocultar-display")
                                //reiniciar bloqueadores de span
                                bloquear_span_cambio_contraseña = false
                                document.querySelector("#bt-cerrar-menu-cambio-data-cuenta-cd").removeEventListener("click", bt_cerrar_menu)
                                document.querySelector("#form-cambio-contraseña").removeEventListener("submit", form_cambio_contraseña)
                            }
                            document.querySelector("#bt-cerrar-menu-cambio-data-cuenta-cd").addEventListener("click", bt_cerrar_menu)
                            //evento cambiar datos cuenta
                            async function form_validar_correo_ajustes_datos_cuenta(e) {
                                e.preventDefault()
                                const code = document.querySelector("#bt-code-introducir-datos-cuenta").value
                                result = await window.sesion_usuario.CAMBIAR_DATOS_CUENTA(contraseña, code, "contraseña")
                                if (!result) {//TODO:notificar:cambiar contraseña


                                }
                                bloquear_span_cambio_contraseña = true
                                //cerrar menu
                                document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.remove("flex-display")
                                document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.add("ocultar-display")
                                document.querySelector("#form-cambio-contraseña").removeEventListener("submit", form_cambio_contraseña)
                                document.querySelector("#form-validation-correo-ajustes-datos-cuenta").removeEventListener("submit", form_validar_correo_ajustes_datos_cuenta)
                                //mostrar log
                                document.querySelector("#seccion-menu-cuenta-ajustes").classList.remove("block-display")
                                document.querySelector("#seccion-menu-cuenta-ajustes").classList.add("ocultar-display")
                                mostrar_menu_sesion(true)
                                mostrar_menu_log(true)
                            }
                            document.querySelector("#form-validation-correo-ajustes-datos-cuenta").addEventListener("submit", form_validar_correo_ajustes_datos_cuenta)

                        }
                        else {//TODO: MOSTRAR MENSAJE DE CAUSA DE FALLO
                            document.querySelector("#bt-cerrar-menu-cambio-data-cuenta-cd").removeEventListener("click", bt_cerrar_menu)
                            bloquear_span_cambio_contraseña = false

                            console.error("FALLO AL CAMBIAR LA CONTRASEÑA")
                        }

                    }
                }
                document.querySelector("#form-cambio-contraseña").addEventListener("submit", form_cambio_contraseña)
            }
            else {
                //TODO: MOSTRAR NOTIFICACION: "Debes esperar 24h desde la última vez para vovler a cambiar la contraseña"
                bloquear_span_cambio_contraseña = true
                console.log("Debes esperar a que termine el bloqueo")
            }
        }
        document.querySelector("#bt-cambiar-contraseña").addEventListener("click", funcion_cambiar_contraseña)

        //cerrar menu cambiar contraseña
        document.querySelector("#bt-cerrar-menu-cambio-contraseña").addEventListener("click", (e) => {
            e.preventDefault()
            document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.remove("flex-display")
            document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.add("ocultar-display")
            //limpiar inputs
            document.querySelector("#cambio-pass").value = ""
            document.querySelector("#cambio-pass-confirm").value = ""
        })
    })


})