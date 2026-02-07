let apodo_render = "Usuario"

async function cambiar_menu_inicio_apodo() {
    apodo_render = await window.sesion_usuario.GET_APODO_SESION()
    document.querySelector("#text-apodo-usuario-menu-inicio").innerHTML = apodo_render
}
document.addEventListener("DOMContentLoaded", () => {
    cambiar_menu_inicio_apodo().then(() => {
        //mensaje bienvenida
        window.pushNotificacion({
            prioridad: 0,        // menor número = más importante
            texto: `Benvido ${apodo_render}`,
            tipo: "info"      // "info", "error", "success"
        })
    })

    //ajustes
    document.querySelector("#bt-seccion-menu-cuenta-ajustes").addEventListener("click", (e) => {
        e.preventDefault()
        cerrar_cuerpos_ajustes("cuenta")
        //mostrar menu de ajustes
        document.querySelector("#seccion-menu-cuenta-ajustes").classList.remove("ocultar-display")
        document.querySelector("#seccion-menu-cuenta-ajustes").classList.add("block-display")
        //cambios de seccion
        async function cerrar_cuerpos_ajustes(no_cerrar) {
            if (no_cerrar == "cuenta") {
                document.querySelector("#cuerpo-ajustes-cuenta").classList.remove("ocultar-display")
                document.querySelector("#cuerpo-ajustes-cuenta").classList.add("flex-display")
                //actualizar datos mostrar
                const fecha_creacion = await window.ajustes_app.OBTENER_FECHA_CREACION_CUENTA()
                const fecha_bloqueo_apodo = await window.ajustes_app.OBTENER_FECHA_BLOQUEO_APODO()
                const fecha_bloqueo_correo = await window.ajustes_app.OBTENER_FECHA_BLOQUEO_CORREO()
                const fecha_bloqueo_contraseña = await window.ajustes_app.OBTENER_FECHA_BLOQUEO_CONTRASEÑA()
                document.querySelector("#text-cuenta-creada-fecha").innerHTML = `*Cuenta creada el ${fecha_creacion}`
                if (fecha_bloqueo_apodo != "") document.querySelector("#bt-fecha-bloqueo-apodo").innerHTML = `*Bloqueado: ${fecha_bloqueo_apodo}h`
                if (fecha_bloqueo_correo != "") document.querySelector("#bt-fecha-bloqueo-correo").innerHTML = `*Bloqueado: ${fecha_bloqueo_correo}h`
                if (fecha_bloqueo_contraseña != "") document.querySelector("#bt-fecha-bloqueo-contraseña").innerHTML = `*Bloqueado: ${fecha_bloqueo_contraseña}h`
            }
            else {
                document.querySelector("#cuerpo-ajustes-cuenta").classList.remove("flex-display")
                document.querySelector("#cuerpo-ajustes-cuenta").classList.add("ocultar-display")
            }
            if (no_cerrar == "general") {
                document.querySelector("#cuerpo-ajustes-general").classList.remove("ocultar-display")
                document.querySelector("#cuerpo-ajustes-general").classList.add("flex-display")
                //TODO:actualizar datos mostrar
            }
            else {
                document.querySelector("#cuerpo-ajustes-general").classList.remove("flex-display")
                document.querySelector("#cuerpo-ajustes-general").classList.add("ocultar-display")
            }
            if (no_cerrar == "notificaciones") {
                document.querySelector("#cuerpo-ajustes-noti").classList.remove("ocultar-display")
                document.querySelector("#cuerpo-ajustes-noti").classList.add("flex-display")
                //TODO:actualizar datos mostrar

            }
            else {
                document.querySelector("#cuerpo-ajustes-noti").classList.remove("flex-display")
                document.querySelector("#cuerpo-ajustes-noti").classList.add("ocultar-display")
            }
            if (no_cerrar == "soporte") {
                document.querySelector("#cuerpo-ajustes-soporte").classList.remove("ocultar-display")
                document.querySelector("#cuerpo-ajustes-soporte").classList.add("flex-display")
                //TODO:actualizar datos mostrar

            }
            else {
                document.querySelector("#cuerpo-ajustes-soporte").classList.remove("flex-display")
                document.querySelector("#cuerpo-ajustes-soporte").classList.add("ocultar-display")
            }
            if (no_cerrar == "saber mas") {
                document.querySelector("#cuerpo-ajustes-saber").classList.remove("ocultar-display")
                document.querySelector("#cuerpo-ajustes-saber").classList.add("flex-display")
                //TODO:actualizar datos mostrar

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
            mostrar_menu_cuenta_creada(false)
            mostrar_menu_validation_code(false)

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
                document.querySelector("#cambio-pass").focus()
                //eventos
                //cambiar contraseña
                async function form_cambio_contraseña(e) {
                    e.preventDefault()
                    const contraseña = document.querySelector("#cambio-pass").value
                    const contraseña_confirmacion = document.querySelector("#cambio-pass-confirm").value
                    //TODO: añadir comprobaciones de validez
                    let valido = true
                    function cambiar_error_contraseña(text) {
                        valido = false
                        document.querySelector("#text-error-form-causa-cambio-contraseña").classList.remove("ocultar-display")
                        document.querySelector("#text-error-form-causa-cambio-contraseña").classList.add("flex-display")
                        document.querySelector("#text-error-form-causa-cambio-contraseña").innerHTML = text
                    }
                    if (contraseña !== contraseña_confirmacion) {
                        valido = false
                        document.querySelector("#cambio-pass-confirm").classList.add("estrada-menu-registro-login-incorrecto")
                        document.querySelector("#span-repetir-contraseña-cambio").classList.add("estrada-menu-registro-login-incorrecto")
                    }

                    document.querySelector("#cambio-pass-confirm").classList.remove("estrada-menu-registro-login-incorrecto")
                    document.querySelector("#span-repetir-contraseña-cambio").classList.remove("estrada-menu-registro-login-incorrecto")
                    if (contraseña.includes(" ")) {
                        cambiar_error_contraseña("*No puedes usar espacios*")
                    }
                    else if (contraseña.length > 30) {
                        cambiar_error_contraseña("*Longitud contraseña <=30*")
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
                            document.querySelector("#bt-code-introducir-datos-cuenta").focus()
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
                                if (!result) {//TODO:notificar:cambiar contraseña error
                                    console.log("no se pudo cambiar")
                                }
                                bloquear_span_cambio_contraseña = true
                                //cambiar a la pagina de log-sesion
                                window.pushNotificacion({
                                    prioridad: 0,        // menor número = más importante
                                    texto: `Contraseña cambiada`,
                                    tipo: "succes"      // "info", "error", "success"
                                })
                                console.log("pagina cambiada")
                                await window.paginas_app.CAMBIAR_PAGINA_SESION()
                            }
                            document.querySelector("#form-validation-correo-ajustes-datos-cuenta").addEventListener("submit", form_validar_correo_ajustes_datos_cuenta)

                        }
                        else {//TODO: MOSTRAR MENSAJE DE CAUSA DE FALLO
                            document.querySelector("#bt-cerrar-menu-cambio-data-cuenta-cd").removeEventListener("click", bt_cerrar_menu)
                            bloquear_span_cambio_contraseña = false

                            console.error("FALLO AL CAMBIAR LA CONTRASEÑA")
                            window.pushNotificacion({
                                prioridad: 0,        // menor número = más importante
                                texto: `Fallo: cambiar contraseña`,
                                tipo: "error"      // "info", "error", "success"
                            })
                        }

                    }
                }
                document.querySelector("#form-cambio-contraseña").addEventListener("submit", form_cambio_contraseña)
            }
            else {
                //TODO: MOSTRAR NOTIFICACION: "Debes esperar 24h desde la última vez para vovler a cambiar la contraseña"
                bloquear_span_cambio_contraseña = true
                console.log("Debes esperar a que termine el bloqueo")
                window.pushNotificacion({
                    prioridad: 0,        // menor número = más importante
                    texto: `Cambiaste de contraseña hace poco \nEsperar: 24h desde la última vez`,
                    tipo: "error"      // "info", "error", "success"
                })
            }
        }
        document.querySelector("#bt-cambiar-contraseña").addEventListener("click", funcion_cambiar_contraseña)
        //mostrar menu cambiar apodo
        let bloquear_span_cambio_apodo = false
        async function funcion_cambiar_apodo(e) {
            e.preventDefault()
            if (bloquear_span_cambio_apodo) {
                //TODO: MOSTRAR NOTIFICACION: "Debes esperar 24h desde la última vez para vovler a cambiar la contraseña"
                return;
            }
            let result = await window.sesion_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ tipo: "apodo" })
            //si puede mostrar menu de cambio de contraseña
            if (result.success) {
                document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.remove("ocultar-display")
                document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.add("flex-display")
                cambiar_seccion_menu_cambiar_datos_cuenta("apodo")
                document.querySelector("#cambio-apodo").focus()
                //eventos
                //cambiar contraseña
                async function form_cambio_apodo(e) {
                    e.preventDefault()
                    const apodo = document.querySelector("#cambio-apodo").value.trim()
                    //TODO: añadir comprobaciones de validez
                    let valido = true
                    function cambiar_error_apodo(text) {
                        valido = false
                        document.querySelector("#text-error-form-causa-cambio-apodo").classList.remove("ocultar-display")
                        document.querySelector("#text-error-form-causa-cambio-apodo").classList.add("flex-display")
                        document.querySelector("#text-error-form-causa-cambio-apodo").innerHTML = text
                    }
                    if (!(/^[a-zA-Z-0-9_]/.test(apodo))) {
                        cambiar_error_apodo("*No puedes usar espacios ni simpobolos raros*")
                    }
                    else if (apodo.length > 30) {
                        cambiar_error_apodo("*Longitud apodo <=30*")
                    }
                    //hacer el cambio de contraseña(validaciones hechas)
                    if (valido) {//cambiar contraseña
                        result = await window.sesion_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: apodo, tipo: "apodo" })

                        if (result && (result.success)) {
                            document.querySelector("#form-cambio-apodo").removeEventListener("submit", funcion_cambiar_apodo)

                            result = await window.sesion_usuario.CAMBIAR_DATOS_CUENTA(apodo, null, "apodo")
                            if (!result) {//TODO:notificar:cambiar contraseña error
                                console.log("no se pudo cambiar")
                            }
                            cambiar_menu_inicio_apodo()
                            bloquear_span_cambio_apodo = true
                            //cambiar a la pagina de log-sesion
                            window.pushNotificacion({
                                prioridad: 0,        // menor número = más importante
                                texto: `Contraseña cambiada`,
                                tipo: "succes"      // "info", "error", "success"
                            })
                            //mostrar menu para introducir codigo
                            document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.remove("flex-display")
                            document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.add("ocultar-display")

                        }
                        else {//TODO: MOSTRAR MENSAJE DE CAUSA DE FALLO
                            bloquear_span_cambio_apodo = false

                            console.error("FALLO AL CAMBIAR EL APODO")
                            window.pushNotificacion({
                                prioridad: 0,        // menor número = más importante
                                texto: `Fallo: cambiar apodo`,
                                tipo: "error"      // "info", "error", "success"
                            })
                        }
                    }
                }
                document.querySelector("#form-cambio-apodo").addEventListener("submit", form_cambio_apodo)
            }
            else {
                //TODO: MOSTRAR NOTIFICACION: "Debes esperar 24h desde la última vez para vovler a cambiar la contraseña"
                bloquear_span_cambio_contraseña = true
                console.log("Debes esperar a que termine el bloqueo")
                window.pushNotificacion({
                    prioridad: 0,        // menor número = más importante
                    texto: `Cambiaste de apodo hace poco \nEsperar: 1h desde la última vez`,
                    tipo: "error"      // "info", "error", "success"
                })
            }
        }
        document.querySelector("#bt-cambiar-apodo").addEventListener("click", funcion_cambiar_apodo)
        //TODO:mostrar menu cambiar correo
        let bloquear_span_cambio_correo = false
        async function funcion_cambiar_correo(e) {
            e.preventDefault()
            if (bloquear_span_cambio_correo) {
                //TODO: MOSTRAR NOTIFICACION: "Debes esperar 24h desde la última vez para vovler a cambiar la contraseña"
                return;
            }
            let result = await window.sesion_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ tipo: "correo" })
            //si puede mostrar menu de cambio de contraseña
            if (result.success) {
                document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.remove("ocultar-display")
                document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.add("flex-display")
                cambiar_seccion_menu_cambiar_datos_cuenta("correo")
                document.querySelector("#cambio-correo").focus()
                //eventos
                //cambiar contraseña
                async function form_cambio_correo(e) {
                    e.preventDefault()
                    const correo_nuevo = document.querySelector("#cambio-correo").value
                    //TODO: añadir comprobaciones de validez
                    let valido = true
                    function cambiar_error_correo(text) {
                        valido = false
                        document.querySelector("#text-error-form-causa-cambio-contraseña").classList.remove("ocultar-display")
                        document.querySelector("#text-error-form-causa-cambio-contraseña").classList.add("flex-display")
                        document.querySelector("#text-error-form-causa-cambio-contraseña").innerHTML = text
                    }
                    if (correo_nuevo.length > 255) {
                        cambiar_error_correo("*Longitud contraseña <=255*")
                    }
                    //hacer el cambio de contraseña(validaciones hechas)
                    if (valido) {//cambiar contraseña
                        result = await window.sesion_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: correo_nuevo, tipo: "correo" })

                        if (result && (result.success)) {
                            document.querySelector("#form-cambio-correo").removeEventListener("submit", form_cambio_correo)

                            //mostrar menu para introducir codigo
                            document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.remove("flex-display")
                            document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.add("ocultar-display")
                            document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.remove("ocultar-display")
                            document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.add("flex-display")
                            document.querySelector("#bt-code-introducir-datos-cuenta").focus()
                            //cerrar validacion codigo de contraseña
                            function bt_cerrar_menu(e) {
                                e.preventDefault()
                                //cerrar menu de ajustes
                                document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.remove("flex-display")
                                document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.add("ocultar-display")
                                //reiniciar bloqueadores de span
                                bloquear_span_cambio_correo = false
                                document.querySelector("#bt-cerrar-menu-cambio-data-cuenta-cd").removeEventListener("click", bt_cerrar_menu)
                                document.querySelector("#form-cambio-correo").removeEventListener("submit", form_cambio_correo)
                            }
                            document.querySelector("#bt-cerrar-menu-cambio-data-cuenta-cd").addEventListener("click", bt_cerrar_menu)
                            //evento cambiar datos cuenta
                            async function form_validar_correo_ajustes_datos_cuenta(e) {
                                e.preventDefault()
                                const code = document.querySelector("#bt-code-introducir-datos-cuenta").value
                                result = await window.sesion_usuario.CAMBIAR_DATOS_CUENTA(correo_nuevo, code, "correo")
                                if (!result) {//TODO:notificar:cambiar contraseña error
                                    console.log("no se pudo cambiar")
                                }
                                bloquear_span_cambio_correo = true
                                //cambiar a la pagina de log-sesion
                                window.pushNotificacion({
                                    prioridad: 0,        // menor número = más importante
                                    texto: `Correo cambiado`,
                                    tipo: "succes"      // "info", "error", "success"
                                })
                                await window.paginas_app.CAMBIAR_PAGINA_SESION()
                            }
                            document.querySelector("#form-validation-correo-ajustes-datos-cuenta").addEventListener("submit", form_validar_correo_ajustes_datos_cuenta)

                        }
                        else {//TODO: MOSTRAR MENSAJE DE CAUSA DE FALLO
                            document.querySelector("#bt-cerrar-menu-cambio-data-cuenta-cd").removeEventListener("click", bt_cerrar_menu)
                            bloquear_span_cambio_correo = false

                            console.error("FALLO AL CAMBIAR EL CORREO")
                            window.pushNotificacion({
                                prioridad: 0,        // menor número = más importante
                                texto: `Fallo: cambiar correo`,
                                tipo: "error"      // "info", "error", "success"
                            })
                        }

                    }
                }
                document.querySelector("#form-cambio-correo").addEventListener("submit", form_cambio_correo)
            }
            else {
                //TODO: MOSTRAR NOTIFICACION: "Debes esperar 24h desde la última vez para vovler a cambiar la contraseña"
                bloquear_span_cambio_correo = true
                console.log("Debes esperar a que termine el bloqueo")
                window.pushNotificacion({
                    prioridad: 0,        // menor número = más importante
                    texto: `Cambiaste de correo hace poco \nEsperar: 24h desde la última vez`,
                    tipo: "error"      // "info", "error", "success"
                })
            }
        }
        document.querySelector("#bt-cambiar-correo").addEventListener("click", funcion_cambiar_correo)

        //cerrar menu cambiar data
        document.querySelector("#bt-cerrar-menu-cambio-data").addEventListener("click", (e) => {
            e.preventDefault()
            document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.remove("flex-display")
            document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.add("ocultar-display")
            //limpiar inputs
            document.querySelector("#cambio-pass").value = ""
            document.querySelector("#cambio-pass-confirm").value = ""
        })
    })
})