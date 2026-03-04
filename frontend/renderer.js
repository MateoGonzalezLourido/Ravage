let contactos_añadir = []//{id , nombre(apodo puesto por ti o apodo propio)}

//ajustes
function Todos_Los_Eventos_Funciones_Ajustes(e) {
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
            const [fecha_creacion, fecha_bloqueo_apodo, fecha_bloqueo_correo, fecha_bloqueo_contraseña, apodo, correo] = await Promise.all([
                window.cuenta_usuario.OBTENER_FECHA_CREACION_CUENTA(),
                window.cuenta_usuario.OBTENER_FECHA_BLOQUEO_APODO(),
                window.cuenta_usuario.OBTENER_FECHA_BLOQUEO_CORREO(),
                window.cuenta_usuario.OBTENER_FECHA_BLOQUEO_CONTRASEÑA(),
                window.cuenta_usuario.GET_APODO_SESION(),
                window.cuenta_usuario.OBTENER_CORREO_USUARIO()
            ])
            // Si tienes elementos en el HTML para mostrar el apodo y correo, puedes añadirlos aquí:
            document.querySelector("#text-cuenta-apodo").innerHTML = `Apodo: <font color="#E53612">${apodo}</font>`
            document.querySelector("#text-cuenta-correo").innerHTML = `Correo electrónico: <font color="#E53612">${correo}</font>`
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
    const formatoScroollAnimacion = {
        behavior: "smooth",
        block: "start"
    }
    function cambiar_ajustes_cuenta(e) {
        e.preventDefault()
        cerrar_cuerpos_ajustes("cuenta")
        document.querySelector("#cuerpo-ajustes-cuenta").scrollIntoView(formatoScroollAnimacion);
    }
    function cambiar_ajustes_general(e) {
        e.preventDefault()
        cerrar_cuerpos_ajustes("general")
        document.querySelector("#cuerpo-ajustes-general").scrollIntoView(formatoScroollAnimacion);
    }
    function cambiar_ajustes_noti(e) {
        e.preventDefault()
        cerrar_cuerpos_ajustes("notificaciones")
        document.querySelector("#cuerpo-ajustes-noti").scrollIntoView(formatoScroollAnimacion);
    }
    function cambiar_ajustes_soporte(e) {
        e.preventDefault()
        cerrar_cuerpos_ajustes("soporte")
        document.querySelector("#cuerpo-ajustes-soporte").scrollIntoView(formatoScroollAnimacion);
    }
    function cambiar_ajustes_saber(e) {
        e.preventDefault()
        cerrar_cuerpos_ajustes("saber mas")
        document.querySelector("#cuerpo-ajustes-saber").scrollIntoView(formatoScroollAnimacion);
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
        let result = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ tipo: "contraseña" })
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
                    result = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: contraseña, tipo: "contraseña" })

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
                            result = await window.cuenta_usuario.CAMBIAR_DATOS_CUENTA(contraseña, code, "contraseña")
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
        let result = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ tipo: "apodo" })
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
                    result = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: apodo, tipo: "apodo" })

                    if (result && (result.success)) {
                        document.querySelector("#form-cambio-apodo").removeEventListener("submit", funcion_cambiar_apodo)

                        result = await window.cuenta_usuario.CAMBIAR_DATOS_CUENTA(apodo, null, "apodo")
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
        let result = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ tipo: "correo" })
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
                const contraseña = document.querySelector("#confirmar-contraseña-correo").value
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
                if (valido) {
                    result = await window.cuenta_usuario.COMPROBAR_CONTRASEÑA({ contraseña: contraseña })
                    valido = result
                }
                if (valido) {//cambiar contraseña
                    result = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: correo_nuevo, tipo: "correo" })

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
                            result = await window.cuenta_usuario.CAMBIAR_DATOS_CUENTA(correo_nuevo, code, "correo")
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
    //listas de bloqueados
    //usuarios silenciados
    function ver_chats_silenciados() {
        e.stopPropagation()
        document.querySelector("#principal-lista-usuarios-silenciados").innerHTML = "*SIN USUARIOS*"
        //actualizar lista
        const lista_datos = window.social_usuario.OBTENER_USUARIOS_SILENCIADOS()
        let html = ""
        if (lista_datos) {
            lista_datos.forEach(usuario => {
                html += `
                <div>
                <span>${usuario.apodo}</span>
                <button data-id="${usuario.id}">Desilenciar</button>
                </div>
                `
            })
        }
        document.querySelector("#principal-lista-usuarios-silenciados").innerHTML = html
        //eventos
        document.querySelectorAll("#principal-lista-usuarios-bloqueados button").forEach(btn => {
            const id = btn.dataset.id;
            const result = window.social_usuario.ELIMINAR_USUARIO_SILENCIADOS(id).then(() => {
                if (!result) {
                    window.pushNotificacion({
                        prioridad: 3,        // menor número = más importante
                        texto: `Fallo al desbloquear usuario`,
                        tipo: "error"      // "info", "error", "success"
                    })
                }
                else {//cambiar html
                    btn.closest("div").remove()//borrar elemento de la lista
                }
            })
        })
        //mostrar lista
        document.querySelector("#lista-usuarios-silenciados").classList.remove("ocultar-display")
        document.querySelector("#lista-usuarios-silenciados").classList.add("flex-display")
        document.querySelector("#bt-cerrar-menu-lista-silenciados").addEventListener("click", () => {
            document.querySelector("#principal-lista-usuarios-silenciados").classList.remove("flex-display")
            document.querySelector("#principal-lista-usuarios-silenciados").classList.add("ocultar-display")
            document.querySelector("#principal-lista-usuarios-silenciados").innerHTML = ""
            document.querySelector("#bt-ver-chats-silenciados").removeEventListener("click", ver_chats_silenciados)
        })
    }
    document.querySelector("#bt-ver-chats-silenciados").addEventListener("click", ver_chats_silenciados)
    //usaurios bloqueados
    function ver_chats_bloqueados(e) {
        e.stopPropagation()
        document.querySelector("#principal-lista-usuarios-bloqueados").innerHTML = "*SIN USUARIOS*"
        //actualizar lista
        const lista_datos = window.social_usuario.OBTENER_USUARIOS_BLOQUEADOS()
        console.log(lista_datos)
        let html = ""
        if (lista_datos) {
            lista_datos.forEach(usuario => {
                html += `
            <div>
            <span>${usuario.apodo}</span>
            <button data-id="${usuario.id}">Desbloquear</button>
            </div>
            `
            })
        }
        document.querySelector("#principal-lista-usuarios-bloqueados").innerHTML = html
        //eventos
        document.querySelectorAll("#principal-lista-usuarios-bloqueados button").forEach(btn => {
            const id = btn.dataset.id;
            const result = window.social_usuario.ELIMINAR_USUARIO_BLOQUEADO(id).then(() => {
                if (!result) {
                    window.pushNotificacion({
                        prioridad: 3,        // menor número = más importante
                        texto: `Fallo al desbloquear usuario`,
                        tipo: "error"      // "info", "error", "success"
                    })
                }
                else {//cambiar html
                    btn.closest("div").remove()//borrar elemento de la lista
                }
            })
        })
        //mostrar lista
        document.querySelector("#lista-usuarios-bloqueados").classList.remove("ocultar-display")
        document.querySelector("#lista-usuarios-bloqueados").classList.add("flex-display")
        document.querySelector("#bt-cerrar-menu-lista-bloqueados").addEventListener("click", () => {
            document.querySelector("#principal-lista-usuarios-bloqueados").classList.remove("flex-display")
            document.querySelector("#principal-lista-usuarios-bloqueados").classList.add("ocultar-display")
            document.querySelector("#principal-lista-usuarios-bloqueados").innerHTML = ""
            document.querySelector("#bt-ver-chats-bloqueados").removeEventListener("click", ver_chats_bloqueados)
        })
    }
    document.querySelector("#bt-ver-chats-bloqueados").addEventListener("click", ver_chats_bloqueados)
}
//chat
function desplegar_menu_añadir_chat({ e, mostrar = true }) {
    if (e) e.preventDefault()
    if (mostrar) {
        document.querySelector("#alineador-seccion-añadir-chat").classList.remove("ocultar-display")
        document.querySelector("#alineador-seccion-añadir-chat").classList.add("flex-display")
        document.querySelector("#texto-buscar-chat-añadir").focus()
    }
    else {
        document.querySelector("#alineador-seccion-añadir-chat").classList.remove("flex-display")
        document.querySelector("#alineador-seccion-añadir-chat").classList.add("ocultar-display")

        contactos_añadir = []
        actualizar_lista_contactos_añadir()
    }
}
function actualizar_lista_contactos_añadir() {
    function crear_eventos() {
        document.querySelectorAll(".componente-lista-contactos-añadidos-chat-crear").forEach((c) => {
            c.addEventListener("click", (e) => {
                const id = e.target.dataset.id
                quitar_contacto_lista_añadir(id)
            })
        })
    }
    let html = ""
    for (c of contactos_añadir) {
        html += `<div class="componente-lista-contactos-añadidos-chat-crear" data-id="${c.id}">${c.nombre}</div>`
    }

    if (contactos_añadir.length == 1) {
        document.querySelector("#contactos-añadidos-grupo").innerHTML = html
        document.querySelector("#bt-agregar-contacto-nuevo").innerHTML = "Crear Chat"
        crear_eventos()
    }
    else if (contactos_añadir.length > 1) {
        document.querySelector("#contactos-añadidos-grupo").innerHTML = html
        document.querySelector("#bt-agregar-contacto-nuevo").innerHTML = "Crear Grupo"
        crear_eventos()
    }
    else {
        document.querySelector("#contactos-añadidos-grupo").innerHTML = "<span>*Agrega contactos</span>"
        document.querySelector("#bt-agregar-contacto-nuevo").innerHTML = "Agregar"
    }
}
function añadir_contacto_lista_añadir(e) {
    const id = e.target.dataset.id
    const nombre = e.target.dataset.nombre
    if (contactos_añadir.findIndex(x => x.id == id) == -1) {
        contactos_añadir.push({ id, nombre })
        actualizar_lista_contactos_añadir()
    }

}
function quitar_contacto_lista_añadir(id) {
    contactos_añadir = contactos_añadir.filter(x => x.id != id)
    actualizar_lista_contactos_añadir()
}
async function buscar_ususario_añadir_chat(e) {
    function crear_eventos() {
        document.querySelectorAll(".componente-posible-usaurio-añadir").forEach(c => {
            c.addEventListener("click", (e) => {
                e.preventDefault()
                añadir_contacto_lista_añadir(e)
            })
        })
    }
    //buscar
    const texto_buscar = document.querySelector("#texto-buscar-chat-añadir").value.trim()
    let resultado;
    if (/[@]/.test(texto_buscar)) {//es correo
        //TODO: HAY QUE COMPROBAR SI EL CORREO ES VALIDO PARA REDUCIR LLAMADAS AL DB
        const correo_usuario = await window.cuenta_usuario.OBTENER_CORREO_USUARIO()
        if (texto_buscar == correo_usuario) return null
        else resultado = await window.social_usuario.ENCONTRAR_USUARIOS_EXTERNOS(texto_buscar, true)
    }
    else if (/[#]/.test(texto_buscar)) {//id amigo
        //TODO: COMPROBAR SI ES UN  ID VALIDO
        const idamigo_usuario = await window.cuenta_usuario.OBTENER_IDAMIGO_USUARIO()
        if (texto_buscar == idamigo_usuario) return null
        else resultado = await window.social_usuario.ENCONTRAR_USUARIOS_EXTERNOS(texto_buscar.replace("#", ""), false)
    }

    if (resultado) {
        document.querySelector("#resultados-busqueda-usaurios").innerHTML = `<div class="componente-posible-usaurio-añadir" data-id="${resultado.id}" data-nombre="${resultado.nombre}">${resultado.nombre}</div>`
        crear_eventos()
    }
    else {
        document.querySelector("#resultados-busqueda-usaurios").innerHTML = `*No hay resultados`
    }
}
async function crear_chat_nuevo(e) {
    e.preventDefault()
    //hay usuarios para crear chat??
    if (contactos_añadir.length == 0) return null
    //nombre del chat
    let nombre = document.querySelector("#nombre-chat-nuevo-crear").value.trim()
    if (nombre == "" && contactos_añadir.length != 1) {
        nombre = "ChatGrupalSiNombre"
    } else if (nombre == "") {
        nombre = contactos_añadir[0].nombre
    }

    //sacar el id del usuario
    const ids = []

    for (i of contactos_añadir) ids.push(i.id)
    contactos_añadir = []
    //TODO: MIRAR SI ES UN NOMBRE VALIDO
    //crear chat y esperar resultado
    const resultado = await window.chats.CREAR_CHAT_NUEVO(ids, nombre)
    //TODO: actualizar html + mandar actualizaciones a los buzones de todos los ids (hacer esta parte asincrona sin await)
    if (resultado) {
        desplegar_menu_añadir_chat({ e, mostrar: false })
        await ACTUALIZAR_LISTAS_CHAT()
    } else {
        //TODO: AVISAR error al crear chat / contacto
    }

}
const chat_componente_lista_structura_html = (datos_usar) => {
    function nombre() {
        if (datos_usar.nombre) return datos_usar.nombre
        else return `<<no encontrado>>`
    }
    function usuarios() {
        if (datos_usar.usuarios.length > 2 && datos_usar.usuarios.length) return (`<div class="numero-integrantes-chat-lista"><span>${datos_usar.usuarios.length} integrantes</span></div>`)
        else return ``
    }
    function ultima_vez() {
        if (datos_usar.usuarios.length <= 2 && datos_usar.ultimoCambio) {

            const fecha = new Date(datos_usar.ultimoCambio);
            const ahora = new Date();

            const hora = fecha.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            });

            // 🔹 Normalizamos fechas a medianoche para comparar días
            const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
            const fechaComparar = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

            const diferenciaDias = (hoy - fechaComparar) / (1000 * 60 * 60 * 24);

            let resultado;

            if (diferenciaDias === 0) {
                resultado = `Hoy, ${hora}`;
            }
            else if (diferenciaDias === 1) {
                resultado = `Ayer, ${hora}`;
            }
            else {
                const dia = fecha.getDate();
                const mes = fecha.toLocaleString("es-ES", {
                    month: "short"
                }).replace(".", "");

                resultado = `${hora}, ${dia} ${mes}`;
            }

            return `<div class="numero-integrantes-chat-lista"><span>${resultado}</span></div>`;
        }
        else {
            return ``;
        }
    }
    function ultimo_mensaje() {
        if (datos_usar.usuarios.length == 2 && datos_usar.ultimomensaje) return (`<div class="ultimo-mensaje-chat-lista"><span>${datos_usar.ultimomensaje}</span></div>`)
        else return ``
    }
    let html = `
    <div data-id="${datos_usar.id}" class="chat-componente-lista-chats">
        <div class="nombre-chat-lista-componente"><span>${nombre()}</span></div>
        ${usuarios()}
        ${ultimo_mensaje()}
        ${ultima_vez()}
    </div>`

    return html
}

const crear_mensaje_html = async (data, id_propio, nombres_contactos) => {
    let html = ""
    const class_mensajes = ["soy-emisor", "soy-receptor"]
    const propio = data.emisor == id_propio

    function emisor_mensaje() {
        if (propio) return class_mensajes[0]
        else return class_mensajes[1]
    }
    async function nombre_emisor() {
        if (propio) return ``

        let html_emisor = `<div class="nombre-mensaje-chat-usuario"><span>`
        const id_emisor = data.emisor
        let nombre_a_mostrar = "Usuario"

        // Buscamos si el emisor está en nuestros contactos
        const indice_contacto = nombres_contactos.findIndex(x => x.id == id_emisor)

        if (indice_contacto == -1) {
            // Si no es contacto, intentamos obtener su apodo externo
            const data_externo = await window.social_usuario.OBTENER_DATOS_USUARIO_EXTERNO(id_emisor, "apodo")
            nombre_a_mostrar = data_externo?.apodo || "<usuario no encontrado>"
        } else {
            // Si es contacto, usamos el apodo que le pusimos
            nombre_a_mostrar = nombres_contactos[indice_contacto].apodo
        }

        html_emisor += nombre_a_mostrar + '</span></div>'
        return html_emisor
    }
    html += `
    <div class="mensaje-chat ${emisor_mensaje()}">
        ${await nombre_emisor()}
        <div class="asunto-mensaje-chat">${data.contenido.asunto}</div>
        <div class="file-mensaje-chat"data-id="${data.contenido.id_file}">${data.contenido.nombre}</div>
    </div>`

    return html
}
//TODO
async function Crear_chat_html(datos, id_propio) {
    let html = ""
    //nav principal
    const nombres_contactos = await window.social_usuario.OBTENER_CONTACTOS_USUARIO()
    async function todo_chat() {
        let html = ""
        if (!datos?.mensajes) return html
        for (m of datos.mensajes) {
            html += (await crear_mensaje_html(m, id_propio, nombres_contactos))
        }

        return html
    }
    html += `
    <div id="nav-prinicpal-chat-usaurio" data-id="${datos?._id}">
        <div id="nombre-chat-nav"><span>${datos?.nombre || "usuario no encontrado"}</span></div>
        <div id="bt-crear-conexion-p2p" title="Iniciar conexion p2p">
            <img src="" draggable="false" alt="">
        </div>
    </div>
    
    <div id="cuerpo-mensajes-chat">
        ${await todo_chat()}
    </div>

    <div class="seccion-escritura-mensaje-chat">
        <div id="bt-añadir-archivo-mensaje-escritura">        
            <img src="" alt="">
        </div>
        <textarea placeholder="Escribe un mensaje"></textarea>
    </div>
    `

    return html
}

//TODO
function mostrar_datos_chat_usaurios(e) {
    e.preventDefault()
    //TODO: MOSTRAR DATOS DEL USUARIO Y DEL CHAT
    const id = e.currentTarget.dataset.id
}
//TODO
function Comenzar_conexion_p2p(e) {
    e.preventDefault()
}
async function ACTUALIZAR_LISTAS_CHAT() {
    try {
        const [lista_chats, lista_contactos] = await Promise.all([
            window.chats.OBTENER_CHATS_USUARIO(),
            window.social_usuario.OBTENER_CONTACTOS_USUARIO()
        ])
        window.chats.LIMPIAR_MENSAJES_CHATS_ANTIGUOS(lista_chats)//!importante: esto hay que hacerlo asincrono porque puede tardar mucho, no importa que el usaurio pueda ver mensajes de hace un año, esto se hace para limpiar el DB

        const datos_chats_grupales = await window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: lista_chats, grupales: null, mensajes: false })
        const id_propio = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
        //crear html lista chats
        //TODO: ORDENAR LOS CHATS POR ULTIMO CAMBIO
        let html = ""
        for (c of lista_chats) {
            //HAY QUE MIRAR SI ES UN GRUPO, SI ES SE COJE EL NOMBRE DE CHATSRAVAGE, SI NO LOS ES SE BUSCA EL ID DEL OTRO USUARIO Y LUEGO EN CONTACTOS SE MIRA SI LO TENGO AGREGADO, SINO SE BUSCA ESE ID POR LA BASE DE DATOS DE USUARIO Y COJEMOS ESE APODO
            let nombre = ""
            //buscar el chat
            const indice_chat = datos_chats_grupales.findIndex(x => x.id == c._id)
            if (indice_chat == -1) throw "ESTE CHAT NO EXISTE EN DB"
            if (c.grupo) {//cojer el nombre del chat
                nombre = datos_chats_grupales[indice_chat].nombre
            } else {//buscar en contactos o usuarios
                //para esto ha que buscar el chat, sacar al otro usuarioF (contacto) y buscar su nombre en nuestros contactos (si no lo tenemos de contacto ponemos el nombre que este use)

                const usuario_buscar = datos_chats_grupales[indice_chat].usuarios.filter(x => x != id_propio)
                //asi solo deberia quedar un id
                if (!usuario_buscar || usuario_buscar.length !== 1) {
                    throw "ERROR AL ENCONTRAR NOMBRE DEL CHAT"
                }
                //buscar en contactos para ver si le tenemos nombre propio
                const indice_contacto = lista_contactos.findIndex(x => x.id == usuario_buscar[0])
                if (indice_contacto == -1) {//buscar por usuarios para cojer el apodo que el usuario tiene
                    const nombre_usuario = await window.social_usuario.OBTENER_DATOS_USUARIO_EXTERNO(usuario_buscar[0], "apodo")
                    if (nombre_usuario) nombre = "~" + nombre_usuario.apodo
                    else throw "USUARIO NO ENCONTRADO"
                }
                else {//buscar el apodo que tenemos
                    nombre = lista_contactos[indice_contacto].apodo
                }

            }
            //nombre, usuarios, ultima_vez ,_id CHAT
            const datos_usar = { id: c.id, ultimoCambio: c.ultimoCambio, usuarios: datos_chats_grupales[indice_chat].usuarios, nombre: nombre, ultimomensaje: c.ultimomensaje }
            html += chat_componente_lista_structura_html(datos_usar)
        }
        document.querySelector("#lista-chats-componentes").innerHTML = html

        document.querySelectorAll(".chat-componente-lista-chats").forEach(componente => {
            componente.addEventListener("click", async (e) => {
                e.preventDefault()
                //TODO: OBTENER LA INFORMACION DEL CHAT Y CREAR EL CHAT EN EL HTML 
                const id = e.currentTarget.dataset.id
                //obtener info de ese chat
                //TODO: AÑADIR METODO DE GUARDADO EN CACHE DE ALGUNOS CHATS USADOS
                const [datos_chat, id_usuario] = await Promise.all([
                    window.chats.OBTENER_DATOS_CHAT_UNICO(id),
                    window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
                ])

                //*obtener el nombre del chat (la dificultad es que puede sser grupo o no, y puede ser contacto o no)
                if (datos_chat && !datos_chat.grupo) {
                    const nombres_contactos = await window.social_usuario.OBTENER_CONTACTOS_USUARIO()
                    const otros_usuarios = (datos_chat.usuarios || []).filter(x => x != id_usuario)
                    const id_buscar = otros_usuarios[0] // Tomamos el primer ID (string) del filtro

                    if (id_buscar) {
                        const indice = nombres_contactos.findIndex(x => x.id == id_buscar)
                        if (indice == -1) {
                            // Obtener datos del usuario externo de forma segura
                            const data_usuarios_externo = await window.social_usuario.OBTENER_DATOS_USUARIO_EXTERNO(id_buscar, "apodo")
                            // Si no existe el objeto o el apodo, usamos el valor por defecto
                            datos_chat.nombre = "~" + (data_usuarios_externo?.apodo || "<usuario no encontrado>")
                        }
                        else {
                            datos_chat.nombre = nombres_contactos[indice].apodo // Usar el apodo guardado en contactos
                        }
                    }
                }

                document.querySelector("#chat-usuario").innerHTML = await Crear_chat_html(datos_chat)
                //eventos
                document.querySelector("#nav-prinicpal-chat-usaurio")?.addEventListener("click", mostrar_datos_chat_usaurios)
                document.querySelector("#nombre-chat-nav")?.addEventListener("click", mostrar_datos_chat_usaurios)
                document.querySelector("#bt-crear-conexion-p2p")?.addEventListener("click", Comenzar_conexion_p2p)


            })
        })
    }
    catch (e) {
        throw e
    }
}
async function INICIO_CHAT_MENU_PRINCIPAL() {
    try {
        await ACTUALIZAR_LISTAS_CHAT()
    }
    catch (e) {
        throw e
    }
}
document.addEventListener("DOMContentLoaded", async () => {
    //mensaje bienvenida
    (async () => {
        const [ajustes_app, apodo] = await Promise.all([
            window.ajustes_app.OBTENER_AJUSTES_APP(),
            window.cuenta_usuario.GET_APODO_SESION()
        ])
        if (ajustes_app.MSBienvenida) {
            window.pushNotificacion({
                prioridad: 0,        // menor número = más importante
                texto: `Benvido ${apodo}`,
                tipo: "info"      // "info", "error", "success"
            })
            //marcar como hecho para no volver a mostrarlo
            ajustes_app.MSBienvenida = false
            window.ajustes_app.GUARDAR_AJUSTES_APP(ajustes_app)
        }
    })()

    //ajustes
    document.querySelector("#bt-seccion-menu-cuenta-ajustes").addEventListener("click", Todos_Los_Eventos_Funciones_Ajustes)
    //chat
    INICIO_CHAT_MENU_PRINCIPAL()
    //TODO: PROMISE_ALL PARA OBETENER LOS CONTACTOS/CHATS Y TODA LA INFORMACION ENECESARIA DE LOS ESTOS Y PARA OBTENER LOS IDS NOMBRES FECHAS... DE LOS ARCHIVOS MANDADOS POR LOS CHATS; TAMBIEN HAY QUE MIRAR EL BUZON Y VER NOVEDADES TIENE (CHATS SIN LEER...)COMPROBAR SI LA APLICACION ESTA ACTUALIZADA; LAS NOTIFICACIONES/CHATS... DEBEN TENER EN CUENTA LOS AJUSTES DEL USUARIO, LA PRIVACIDAD, SI SE HAN BLOQUEADO CHATS NO TENERLOS EN CUENTA...
    //añadir chat
    document.querySelector("#bt-añadir-chat").addEventListener("click", (e) => desplegar_menu_añadir_chat({ e, mostrar: true }))
    document.querySelector("#bt-cerrar-menu-añadir-chats").addEventListener("click", (e) => desplegar_menu_añadir_chat({ e, mostrar: false }))
    document.querySelector("#texto-buscar-chat-añadir").addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();

            await buscar_ususario_añadir_chat(e)
        }
    })
    document.querySelector("#bt-agregar-contacto-nuevo").addEventListener("click", crear_chat_nuevo)

    /*TODO: obtener buzon y mostrar cambios en lista chats si hay(usando id del chat)  mostrar notificaciones de otras cosas */
})