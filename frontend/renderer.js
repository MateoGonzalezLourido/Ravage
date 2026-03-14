let contactos_añadir = []//{id , nombre(apodo puesto por ti o apodo propio)}
let archivos_mensaje = []//{ruta,nombre,extension}
let archivo_cambiando_nombre; //es para guardar el archivo que se esta editando ya
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
                    else {// MOSTRAR MENSAJE DE CAUSA DE FALLO
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
            //Mostrar notificacion aviso bloqueo temporal activo
            bloquear_span_cambio_contraseña = true
            console.log("Debes esperar a que termine el bloqueo")
            window.pushNotificacion({
                prioridad: 1,        // menor número = más importante
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
            //Mostrar notificacion aviso bloqueo temporal activo
            console.log("Debes esperar a que termine el bloqueo")
            window.pushNotificacion({
                prioridad: 1,        // menor número = más importante
                texto: `Cambiaste de apodo hace poco \nEsperar: 1h desde la última vez`,
                tipo: "error"      // "info", "error", "success"
            })
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
                        if (!result) {//notificar:cambiar contraseña error
                            console.log("no se pudo cambiar el apodo")
                            window.pushNotificacion({
                                prioridad: 0,        // menor número = más importante
                                texto: `No se pudo cambiar el apodo`,
                                tipo: "error"      // "info", "error", "success"
                            })
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
                    else {// MOSTRAR MENSAJE DE CAUSA DE FALLO
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
            //Mostrar notificacion aviso bloqueo temporal activo
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
    //mostrar menu cambiar correo
    let bloquear_span_cambio_correo = false
    async function funcion_cambiar_correo(e) {
        e.preventDefault()
        if (bloquear_span_cambio_correo) {
            //Mostrar notificacion aviso bloqueo temporal activo
            window.pushNotificacion({
                prioridad: 1,        // menor número = más importante
                texto: `Cambiaste de correo hace poco \nEsperar: 72h desde la última vez`,
                tipo: "error"      // "info", "error", "success"
            })
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
                            if (!result) {//notificar:cambiar contraseña error
                                console.log("no se pudo cambiar")
                            }
                            bloquear_span_cambio_correo = true
                            //cambiar a la pagina de log-sesion
                            window.pushNotificacion({
                                prioridad: 1,        // menor número = más importante
                                texto: `Correo cambiado`,
                                tipo: "succes"      // "info", "error", "success"
                            })
                            await window.paginas_app.CAMBIAR_PAGINA_SESION()
                        }
                        document.querySelector("#form-validation-correo-ajustes-datos-cuenta").addEventListener("submit", form_validar_correo_ajustes_datos_cuenta)

                    }
                    else {// MOSTRAR MENSAJE DE CAUSA DE FALLO
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
            //Mostrar notificacion aviso bloqueo temporal activo

            bloquear_span_cambio_correo = true
            console.log("Debes esperar a que termine el bloqueo")
            window.pushNotificacion({
                prioridad: 1,        // menor número = más importante
                texto: `Cambiaste de correo hace poco \nEsperar: 72h desde la última vez`,
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
function desplegar_menu_añadir_chat({ e = null, mostrar = true, id_chat = null }) {
    if (e) e.preventDefault()
    if (mostrar) {
        //cambiar el idchat del boton crear chat, para en vez de crear chat añadir usuario a ese chat
        document.querySelector("#bt-agregar-contacto-nuevo").dataset.id_chat = id_chat

        document.querySelector("#alineador-seccion-añadir-chat").classList.remove("ocultar-display")
        document.querySelector("#alineador-seccion-añadir-chat").classList.add("flex-display")

        document.querySelector("#texto-buscar-chat-añadir").focus()
    }
    else {
        document.querySelector("#alineador-seccion-añadir-chat").classList.remove("flex-display")
        document.querySelector("#alineador-seccion-añadir-chat").classList.add("ocultar-display")
        //limpiar datos y html
        contactos_añadir = []
        actualizar_lista_contactos_añadir()
        document.querySelector("#texto-buscar-chat-añadir").value = ""
        document.querySelector("#resultados-busqueda-usaurios").innerHTML = "<span>*Sin resultados</span>"
        document.querySelector("#contactos-añadidos-grupo").innerHTML = "<span>*Agregar usuarios para el chat</span>"
        document.querySelector("#nombre-chat-nuevo-crear").value = ""
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
let _cache_img_extensiones = null
async function url_icono_extension_img(extension) {
    if (!_cache_img_extensiones) {
        try {
            const res = await fetch('./recursos/extensionesArchivos/img_extensiones.json')
            _cache_img_extensiones = await res.json()
        } catch (err) {
            console.error("Error al cargar img_extensiones.json:", err)
            _cache_img_extensiones = {}
        }
    }
    const img_defecto = "cualquiera.svg"
    const img_usar = _cache_img_extensiones[extension?.toLowerCase()] || img_defecto
    const url_img = `./recursos/extensionesArchivos/${img_usar}`
    const identificado = img_usar !== img_defecto
    return [url_img, identificado]
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
    //EXCLUIR USUARIOS YA EXISTENTES SI ES AÑADIR USUARIO A UN CHAT EXISTENTE
    const id_chat = document.querySelector("#bt-agregar-contacto-nuevo")?.dataset.id_chat || null
    if (id_chat) {
        const info_chat = await window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat, "usuarios")
        if (info_chat?.usuarios?.includes(resultado.id)) {
            resultado = null
        }
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

    const id_chat = document.querySelector("#bt-agregar-contacto-nuevo")?.dataset.id_chat || null

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
    const resultado = await window.chats.CREAR_CHAT_NUEVO(ids, nombre, id_chat)
    //TODO: actualizar html + mandar actualizaciones a los buzones de todos los ids (hacer esta parte asincrona sin await)
    if (resultado) {
        desplegar_menu_añadir_chat({ e, mostrar: false })
        if (!id_chat) await ACTUALIZAR_LISTAS_CHAT()
    } else {
        //AVISAR error al crear chat / contacto
        window.pushNotificacion({
            prioridad: 1,        // menor número = más importante
            texto: id_chat ? `Error al añadir usuario al chat` : `Error al crear chat`,
            tipo: "error"      // "info", "error", "success"
        })
    }

}
const chat_componente_lista_structura_html = (datos_usar) => {
    function nombre() {
        if (datos_usar.nombre) return datos_usar.nombre
        else return `<<no encontrado>>`
    }
    function usuarios() {
        if (datos_usar.usuarios.length > 2 && datos_usar.usuarios.length) return (`<div class="numero-integrantes-chat-lista"><span>${[...new Set(datos_usar?.usuarios)]?.length || 0} integrantes</span></div>`)
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
    const class_mensajes = ["soy-emisor", "soy-receptor"]
    let html = ""
    // El emisor es un array, cojemos el primer integrante
    const id_emisor = Array.isArray(data.emisor) ? data.emisor[0] : data.emisor
    const propio = id_emisor == id_propio

    function emisor_mensaje() {
        if (propio) return class_mensajes[0]
        else return class_mensajes[1]
    }
    function asunto_mensaje() {
        if (data.contenido[0].asunto) return `<div class="asunto-mensaje-chat">${data.contenido[0].asunto}</div> `
        return ``
    }
    async function nombre_emisor() {
        if (propio) return ``

        let html_emisor = `<div class="nombre-mensaje-chat-usuario"><span>`
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
    function hora_mandado() {
        const fecha = new Date(data.data);
        const hora = fecha.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
        return `<div class="hora-mensaje-chat"><span>${hora}</span></div>`
    }
    async function archivos_mensaje() {
        if (data.contenido[0]?.archivos?.length > 0) {
            let html = `<div class="mensaje-div-archivos">`
            for (const archivo of data.contenido[0]?.archivos) {
                const extension = archivo?.extension || archivo.nombre?.includes(".") ? archivo.nombre.split(".").pop() : null
                const [url, identificado] = await url_icono_extension_img(extension)
                const nombre_mostrar = identificado ? (archivo.nombre?.includes(".") ? archivo.nombre.substring(0, archivo.nombre.lastIndexOf(".")) : archivo.nombre) : archivo.nombre

                html += `<div class="archivo-mensaje-div-archivos" data-id="${archivo.id}" data-nombre="${archivo.nombre}">
                <div><img src="${url}"><span>${nombre_mostrar}</span></div>
                </div> `
            }
            html += "</div>"
            return html
        }
        else return ``
    }
    html += `
    <div class="mensaje-chat ${emisor_mensaje()}">
        ${await nombre_emisor()}
        ${asunto_mensaje()}
        ${data.contenido[0].id_file ? `<div class="file-mensaje-chat"data-id="${data.contenido[0].id_file}">${data.contenido[0].nombre}</div>` : ""}
        ${await archivos_mensaje()}
        ${hora_mandado()}
    </div> `

    return html
}
//TODO
async function Crear_chat_html(datos, id_propio) {
    //limpiar residuos de otros chats
    archivos_mensaje = []

    let html = ""
    //nav principal
    const nombres_contactos = await window.social_usuario.OBTENER_CONTACTOS_USUARIO()
    async function todo_chat() {
        let html = ""
        if (!datos?.mensajes) return html

        // Ordenar mensajes por fecha (de más antiguo a más reciente)
        const mensajes_ordenados = [...datos.mensajes].sort((a, b) => {
            return new Date(a.data) - new Date(b.data)
        })
        let fecha_ultimo;
        for (m of mensajes_ordenados) {
            //QUE AL DEJAR DE TENER ESTO DE LA FECHA EN LA PANTALLA APAREZCA FIXED ARRIBA DEL CHAT (LA FECHA QUE PERTEZCA AL BLOQUE QUE ESTAMOS VIENDO)
            //comparar si son del mismo dia
            const fecha_actual = new Date(m.data)
            const fecha_comparar = new Date(fecha_ultimo)
            const texto_mostrar_fecha_mensajes_bloque = (fecha_ultimo) => {
                //mirar si es hoy
                if (fecha_ultimo.toDateString() === new Date().toDateString()) return "Hoy"
                //mirar si fue ayer
                else if (fecha_ultimo.toDateString() === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()) return "Ayer"
                //mirar si es de la misma semana
                else if (fecha_ultimo.getDay() === new Date().getDay()) return fecha_ultimo.toLocaleString("es-ES", {
                    weekday: "long"
                })
                // mirar si es del mismo mes y año
                else if (fecha_ultimo.getMonth() === new Date().getMonth() && fecha_ultimo.getFullYear() === new Date().getFullYear()) {
                    //devolver el dia del mes y nombre del dia de la semana
                    return fecha_ultimo.toLocaleString("es-ES", {
                        weekday: "long"
                    }) + " " + fecha_ultimo.getDate() + ", " + fecha_ultimo.toLocaleString("es-ES", {
                        month: "long"
                    }) + " " + fecha_ultimo.getFullYear()
                }
                else return fecha_ultimo.toDateString()
            }
            if (fecha_actual.toDateString() !== fecha_comparar.toDateString() || !fecha_ultimo) {
                html += `<div class="fecha-mensaje-chat"> <span>${texto_mostrar_fecha_mensajes_bloque(fecha_actual)}</span></div> `
            }
            fecha_ultimo = m.data
            html += (await crear_mensaje_html(m, id_propio, nombres_contactos))
        }

        return html
    }
    html += `
    <div id = "nav-prinicpal-chat-usaurio" data-id="${datos?._id}">
        <div id="nombre-chat-nav"><span>${datos?.nombre || "usuario no encontrado"}</span></div>
    </div>
    
    <div id="cuerpo-mensajes-chat">
        ${await todo_chat()}
    </div>

    <div class="seccion-escritura-mensaje-chat">
        <div id="bt-añadir-archivo-mensaje-escritura">        
            <img src="./recursos/carpeta.svg" alt="">
        </div>
        <textarea id="textarea-mensaje-escritura" placeholder="Escribe un mensaje"></textarea>
    </div>
`

    return html
}

async function mostrar_datos_chat_usaurios(e) {
    e.preventDefault()
    // MOSTRAR DATOS DEL USUARIO Y DEL CHAT
    const id_chat = e.currentTarget.dataset.id || document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id
    const info_chat = await window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat)
    const infoSeccion = document.querySelector("#info-chat-seccion")

    //crear html de la seccion
    const nombre_chat = document.querySelector("#nombre-chat-nav span")?.textContent || "no encontrado";
    const añadido_nombre_chat = async () => {
        if (info_chat?.grupo && info_chat?.usuarios) {
            return `<div> ${[...new Set(info_chat?.usuarios)]?.length || 0} integrantes</div> `
        } else {
            // Obtener el ID del usuario principal
            const id_mio = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
            // Filtrar para quedarse con el ID del otro usuario
            const id_otro = info_chat?.usuarios.find(u => u !== id_mio)

            if (id_otro) {
                // Buscar la info en la base de datos de ese ID
                const datos_otro = await window.social_usuario.OBTENER_DATOS_USUARIO_EXTERNO(id_otro)
                if (datos_otro?.correo) return `<div> ${datos_otro?.correo}</div> `
                return ``
            }
            return `<div> Chat individual</div> `
        }
    }

    const fecha_formateada = info_chat?.fecha_creacion
        ? new Date(info_chat.fecha_creacion).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : "*No disponible";

    let html = `
    <div class="info-chat-header">
        <div id="bt-cerrar-info-chat">
            <img src="./recursos/cruz.png" alt="cerrar">
        </div>
        <span>Información del chat</span>
    </div>

    <div class="info-chat-cuerpo">
        <div class="info-chat-perfil">
            <div class="info-chat-nombre">
                <span>${nombre_chat}</span>
            </div>
            <div class="info-chat-subtitulo">
                ${await añadido_nombre_chat()}
            </div>
        </div>

        <div class="info-chat-detalles">
            <div class="info-chat-item">
                <span class="info-chat-label">Mensajes</span>
                <span class="info-chat-valor">${info_chat?.mensajes?.length || 0}</span>
            </div>
            <div class="info-chat-item">
                <span class="info-chat-label">Creado el</span>
                <span class="info-chat-valor">${fecha_formateada}</span>
            </div>
        </div>

        <div class="div-botones-info-chat">
            <button id="bt-ver-archivos-chat">
                Ver Archivos
            </button>
        </div>

        ${info_chat?.grupo ? await (async () => {
            const id_mio = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
            let participantes_ids = [...new Set(info_chat.usuarios)]//quitar repetidos
            participantes_ids = participantes_ids.filter(id => id !== id_mio)//quitar el id propio

            // Obtener datos de todos los participantes en paralelo
            //TODO: SI NO TIENE HABILITADO EL CORREO NO TRAERLO (cada usuario)
            //TODO: OPTIMIZAR DATOS QUE SE NECESITAN TRAER (solo apodo, correo?,idamigo)
            const participantes_promesas = participantes_ids.map(id => window.social_usuario.OBTENER_DATOS_USUARIO_EXTERNO(id))
            const participantes_datos = await Promise.all(participantes_promesas)

            let lista_html = `
            <div class="info-chat-lista-participantes">
                <div class="info-chat-lista-titulo">Participantes (${participantes_datos.length + 1}) <div id="bt-anadir-participante-chat">+</div></div>
                <div class="info-chat-lista-items">
                <div class="info-chat-participante-item">
                    <div class="info-chat-participante-info">
                        <span class="info-chat-participante-nombre">Tú</span>
                        <span class="info-chat-participante-correo">${await window.cuenta_usuario.OBTENER_CORREO_USUARIO()}</span>
                    </div>
                </div>
            `
            participantes_datos.forEach(p => {
                if (p) {
                    lista_html += `
                    <div class="info-chat-participante-item">
                        <div class="info-chat-participante-info">
                            <span class="info-chat-participante-nombre">${p.apodo || "Sin apodo"}</span>
                            <span class="info-chat-participante-correo">${p.correo || ""}</span>
                        </div>
                    </div>
                    `
                }
            })
            lista_html += `</div></div>`
            return lista_html
        })() : ''}
    </div>
`
    infoSeccion.innerHTML = html

    // Eventos de la sección de información
    document.querySelector("#bt-cerrar-info-chat")?.addEventListener("click", () => {
        infoSeccion.classList.remove("abierto")
    })

    document.querySelector("#bt-ver-archivos-chat")?.addEventListener("click", () => {
        console.log("Abriendo archivos del chat:", id_chat)
        // TODO: Implementar el menú de archivos mandados
    })

    document.querySelector("#bt-anadir-participante-chat")?.addEventListener("click", (e) => {
        e.preventDefault()
        // TODO: Implementar el menú de añadir participante
        desplegar_menu_añadir_chat({ mostrar: true, id_chat: id_chat })

    })
    //mostrar seccion + cambiar css secciones

    if (infoSeccion) {
        // Toggle the info section
        infoSeccion.classList.toggle("abierto")
        // If it's now open, close the attachment menu if it exists (abruptly snap)
        if (infoSeccion.classList.contains("abierto")) {
            const ventanaArchivos = document.querySelector(".ventana-archivos-mensaje")
            if (ventanaArchivos) {
                // Snap close instantly without animation
                ventanaArchivos.style.transition = "none"
                ventanaArchivos.style.width = "0"
                ventanaArchivos.classList.remove("abierto")
                ventanaArchivos.remove()
            }
        }
    }
}
function cerrar_paneles_al_abrir_chat() {
    // Cerrar #info-chat-seccion si está abierto
    const infoSeccion = document.querySelector("#info-chat-seccion")
    if (infoSeccion && infoSeccion.classList.contains("abierto")) {
        infoSeccion.classList.remove("abierto")
    }
    // Cerrar .ventana-archivos-mensaje si está abierta
    const ventanaArchivos = document.querySelector(".ventana-archivos-mensaje")
    if (ventanaArchivos) {
        ventanaArchivos.classList.remove("abierto")
        setTimeout(() => ventanaArchivos.remove(), 310)
    }
}
async function ACTUALIZAR_LISTAS_CHAT() {
    try {
        archivo_cambiando_nombre = null
        const [lista_chats, lista_contactos] = await Promise.all([
            window.chats.OBTENER_CHATS_USUARIO(),
            window.social_usuario.OBTENER_CONTACTOS_USUARIO()
        ])
        window.chats.LIMPIAR_MENSAJES_CHATS_ANTIGUOS(lista_chats)//!importante: esto hay que hacerlo asincrono porque puede tardar mucho, no importa que el usaurio pueda ver mensajes de hace un año, esto se hace para limpiar el DB

        const datos_chats_grupales = await window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: lista_chats, grupales: null, mensajes: false })
        const id_propio = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
        //crear html lista chats
        // ORDENAR LOS CHATS POR ULTIMO CAMBIO (El más reciente arriba)
        const lista_chats_ordenada = [...lista_chats].sort((a, b) => {
            return new Date(b.ultimoCambio) - new Date(a.ultimoCambio)
        })

        let html = ""
        for (c of lista_chats_ordenada) {
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
                // OBTENER LA INFORMACION DEL CHAT Y CREAR EL CHAT EN EL HTML 
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
                datos_chat._id = id
                document.querySelector("#chat-usuario").innerHTML = await Crear_chat_html(datos_chat, id_usuario)
                //cerrar paneles laterales si están abiertos
                cerrar_paneles_al_abrir_chat()
                //scroll al final
                scroll_fin_chat()
                //crear observadores doom para el sistema de fecha de bloques mensajes
                const elementos = document.querySelectorAll(".fecha-bloque-mensajes");
                const fixed_text = "text-fecha-bloques-mensajes-fixed"
                const observer = new IntersectionObserver((entries) => {

                    entries.forEach(entry => {

                        const html = entry.target.innerHTML;

                        if (entry.isIntersecting) {
                            // cuando se ve
                            entry.target.classList.remove(fixed_text)
                        } else {
                            // cuando deja de verse (si no es hoy)
                            if (!html.includes("Hoy")) mostrarFechaBloqueMensajes(html);
                        }

                    });

                });
                elementos.forEach(el => observer.observe(el));
                function mostrarFechaBloqueMensajes(html) {
                    const contenedor = document.querySelector("#chat-usuario");
                    const hijo = document.createElement("div");
                    const text = document.createElement("span")
                    text.innerHTML = html
                    hijo.appendChild(text)
                    hijo.classList.add(fixed_text)
                    contenedor.appendChild(hijo);
                }
                //eventos
                document.querySelector("#nav-prinicpal-chat-usaurio")?.addEventListener("click", mostrar_datos_chat_usaurios)
                //cambio altura del textarea del mensaje , segun lo grande que sea el mensaje, para facilitar su lectura y escritura
                const textarea_msg = document.querySelector("#textarea-mensaje-escritura")
                if (textarea_msg) {
                    // Crecimiento dinámico
                    textarea_msg.addEventListener("input", function () {
                        this.style.height = "38px" // Vuelve al tamaño mínimo base para recalcular la caída recta
                        this.style.height = (this.scrollHeight) + "px"
                    })

                    textarea_msg.addEventListener("keypress", async (e) => {
                        // Enviar con Enter, pero permitir salto de línea con Shift+Enter
                        if (e.key == "Enter" && !e.shiftKey) {
                            e.preventDefault() // Evitar salto de línea artificial al enviar
                            const mensaje = textarea_msg.value.trim()
                            const id_chat = document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id
                            const id_usuario = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()

                            // Si el mensaje está vacío y no hay archivos, evitar enviar nada
                            if (!mensaje && archivos_mensaje.length === 0) return;

                            const result = await window.chats.ENVIAR_MENSAJE({ asunto: mensaje, archivos: archivos_mensaje, id_chat: id_chat, id_emisor: id_usuario })
                            if (result) {//limpiar seccion mensaje escritura
                                const copia_archivos = archivos_mensaje
                                archivos_mensaje = []
                                textarea_msg.value = ""
                                textarea_msg.style.height = "38px" // Restaurar tamaño original base
                                document.querySelectorAll(".ventana-archivos-mensaje").forEach(x => x.remove())

                                //reactualizar chat (render)
                                Actualizar_render_chat({ emisor: id_usuario, chat: id_chat, mensaje: mensaje, archivos: copia_archivos, fecha: new Date() })
                            }
                        }
                    })
                }
                //guardar archivos(al hacer click mostrar una ventana para subir archivos)
                document.querySelector("#bt-añadir-archivo-mensaje-escritura")?.addEventListener("click", async () => {
                    //si existe cerrarla con animación
                    const existente = document.querySelector(".ventana-archivos-mensaje")
                    if (existente) {
                        existente.classList.remove("abierto")
                        setTimeout(() => existente.remove(), 310)
                        return;
                    }
                    //crear ventana
                    async function mostrar_lista_archivos(archivos) {
                        let html = ``
                        for (const archivo of archivos) {
                            const [url, identificado] = await url_icono_extension_img(archivo.extension)

                            html += `
                            <div class="info-chat-participante-item ventana-archivos-mensaje-cuerpo-cuerpo-item">
                                <div data-indice="${archivos.indexOf(archivo)}" class="info-chat-participante-info ventana-archivos-mensaje-cuerpo-cuerpo-item-nombre">
                                    <div class="contenido-item-archivo-lista" style="display: flex; align-items: center; gap: 10px;">
                                        <img draggable="false" src="${url}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: contain;">
                                        <span class="info-chat-participante-nombre">${identificado ? archivo.nombre : archivo.nombre + "." + archivo.extension}</span>
                                    </div>
                                </div>
                            </div>
                            `
                        }
                        return html
                    }
                    const html_lista_archivos = await mostrar_lista_archivos(archivos_mensaje)
                    const ventana = document.createElement("div")
                    ventana.className = "ventana-archivos-mensaje"
                    // HTML Structure mimicking #info-chat-seccion
                    ventana.innerHTML = `
                    <div class="info-chat-header">
                        <div id="bt-cerrar-archivos-mensaje" class="bt-cerrar-archivos-header">
                            <img src="./recursos/cruz.png" alt="cerrar">
                        </div>
                        <div> <span>Archivos Adjuntos</span></div>
                        <div id="bt-añadir-archivos-mensaje-escritura" class="bt-accion-archivos"title="añadir-archivo">
                            <img src="./recursos/suma.png" alt="añadir">
                        </div>
                        <div  id="bt-limpiar-archivos-mensaje-escritura" class="bt-accion-archivos bt-accion-archivos-peligro">
                            <img src="./recursos/escoba.png" alt="limpiar">
                        </div>
                    </div>
                    
                    <div class="info-chat-cuerpo ventana-archivos-mensaje-cuerpo">
                        <div class="info-chat-lista-participantes ventana-archivos-mensaje-cuerpo-cuerpo">
                            ${html_lista_archivos}
                        </div>
                    </div>`

                    // Insertar en DOM con transición y ancho bloqueados en inline style
                    ventana.style.transition = "none"
                    ventana.style.width = "0"
                    document.querySelector(".seccion-cuerpo-chat").appendChild(ventana)

                    // Cerrar el panel de info si está abierto (snap sin animación)
                    const infoSeccion = document.querySelector("#info-chat-seccion")
                    if (infoSeccion && infoSeccion.classList.contains("abierto")) {
                        infoSeccion.style.transition = "none"
                        infoSeccion.classList.remove("abierto")
                        infoSeccion.style.width = "0"
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            infoSeccion.style.transition = ""
                            infoSeccion.style.width = "" // Limpiar inline para que el CSS controle
                        }))
                    }

                    // Doble rAF: el navegador pinta a width:0, luego borramos los
                    // inline styles y añadimos .abierto para que la transición CSS anime a 350px
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            ventana.style.transition = ""
                            ventana.style.width = ""  // CLAVE: limpiar inline, la clase .abierto ya define 350px
                            ventana.classList.add("abierto")
                        })
                    })

                    // Event to close this menu
                    document.querySelector("#bt-cerrar-archivos-mensaje").addEventListener("click", () => {
                        ventana.classList.remove("abierto")
                        setTimeout(() => ventana.remove(), 310)
                    })
                    //eventos
                    //contextmenu de cada archivo(borrar, editar nombre/extension)
                    document.querySelectorAll(".ventana-archivos-mensaje-cuerpo-cuerpo").forEach(el => {
                        el.addEventListener("click", (e) => {
                            e.preventDefault()

                            // Obtener el item específico clicado para sacar su índice y el elemento del DOM
                            const itemClicado = e.target.closest(".ventana-archivos-mensaje-cuerpo-cuerpo-item-nombre")
                            if (!itemClicado) return

                            const indice = itemClicado.dataset.indice
                            const archivo = archivos_mensaje[indice]

                            if (!archivo) {
                                //marcarlo en rojo para que el usuario vea que esta fallando ese archivo
                                itemClicado.style.color = "orange"
                                itemClicado.style.fontStyle = "italic"
                                itemClicado.style.textDecoration = "line-through";
                                return;
                            }

                            // Eliminar menú previo si existe para evitar duplicados
                            document.querySelector(".context-menu")?.remove()

                            const html_contextMenu = `
                                <div class="context-menu" style="position: fixed; z-index: 1000;">
                                    <div class="context-menu-item" data-action="borrar"> Borrar</div>
                                    <div class="context-menu-item" data-action="editar">Editar</div>
                                </div>
                            `

                            const ventanaContenedor = document.querySelector(".ventana-archivos-mensaje")
                            ventanaContenedor.insertAdjacentHTML("beforeend", html_contextMenu)

                            const menu = ventanaContenedor.querySelector(".context-menu")
                            if (menu) {
                                menu.style.left = e.clientX + "px"
                                menu.style.top = e.clientY + "px"

                                // Cerrar al hacer click fuera
                                const cerrarMenuClickFuera = (event) => {
                                    if (!menu.contains(event.target)) {
                                        menu.remove()
                                        document.removeEventListener("mousedown", cerrarMenuClickFuera)
                                    }
                                }
                                document.addEventListener("mousedown", cerrarMenuClickFuera)
                            }

                            menu.addEventListener("click", (ev) => {
                                const action = ev.target.dataset.action
                                if (action === "borrar") {
                                    //borar de la lista de datos
                                    archivos_mensaje.splice(indice, 1)
                                    //borrar del html (el item padre)
                                    itemClicado.closest(".ventana-archivos-mensaje-cuerpo-cuerpo-item").remove()
                                    //actualizar indices
                                    let indice_actual = -1
                                    for (el_item of document.querySelectorAll(".ventana-archivos-mensaje-cuerpo-cuerpo-item-nombre")) {
                                        indice_actual++
                                        if (indice_actual >= indice) {
                                            el_item.dataset.indice = indice_actual
                                        }
                                    }
                                }
                                else if (action === "editar") { //editar nombre/extension
                                    const name_textarea_class = "seccion-cambiar-nombre-archivo-mensaje"

                                    // Si ya hay uno editándose en otro lado, lo cerramos
                                    if (archivo_cambiando_nombre) {
                                        const prevTextarea = document.querySelector(`.${name_textarea_class}`)
                                        if (prevTextarea) {
                                            const nuevoNombre = prevTextarea.value.trim()
                                            const prevIndice = archivo_cambiando_nombre.dataset.indice
                                            if (archivos_mensaje[prevIndice]) archivos_mensaje[prevIndice].nombre = nuevoNombre

                                            const span = archivo_cambiando_nombre.querySelector("span")
                                            if (span) {
                                                span.innerHTML = nuevoNombre
                                                span.style.display = "flex"
                                            }
                                            prevTextarea.remove()
                                        }
                                    }

                                    // Guardar el item actual que se está editando
                                    archivo_cambiando_nombre = itemClicado

                                    const spanActual = itemClicado.querySelector("span")
                                    if (spanActual) spanActual.style.display = "none"

                                    const textarea = document.createElement("textarea")
                                    textarea.className = name_textarea_class
                                    textarea.value = archivo.nombre
                                    itemClicado.querySelector(".contenido-item-archivo-lista").appendChild(textarea)
                                    textarea.focus()

                                    textarea.addEventListener("keypress", (event) => {
                                        if (event.key == "Enter" && !event.shiftKey) {
                                            event.preventDefault()
                                            let nombre_nuevo = textarea.value.trim()
                                            archivo.nombre = nombre_nuevo

                                            if (spanActual) {
                                                spanActual.innerHTML = nombre_nuevo
                                                spanActual.style.display = "flex"
                                            }
                                            textarea.remove()
                                            archivo_cambiando_nombre = null
                                        }
                                    })
                                }
                                menu.remove()
                            })
                        })
                    })

                    //añadir archivos
                    document.querySelector("#bt-añadir-archivos-mensaje-escritura").addEventListener("click", async () => {
                        const archivos = await window.chats.SELECCIONAR_ARCHIVOS()//[ruta]
                        //añadir archivos a la lista
                        for (const archivo of archivos) {
                            try {
                                const estructura = archivo.split('\\')
                                const nombre_extension = estructura[estructura.length - 1].split('.')
                                archivos_mensaje.push({
                                    nombre: nombre_extension[0],
                                    extension: nombre_extension[1],
                                    ruta: archivo
                                })
                            }
                            catch (e) {// MOSTRAR ERROR PANTALLA
                                console.error(e)
                                window.pushNotificacion({
                                    prioridad: 1,        // menor número = más importante
                                    texto: `Error al añadir archivo${archivo.nombre + archivo.extension} \nRuta: ${archivo.ruta} `,
                                    tipo: "error"      // "info", "error", "success"
                                })
                            }
                        }
                        //actualizar vista seccion archivos
                        document.querySelector(".ventana-archivos-mensaje-cuerpo-cuerpo").innerHTML = await mostrar_lista_archivos(archivos_mensaje)
                    })
                    //limpiar arhivos
                    document.querySelector("#bt-limpiar-archivos-mensaje-escritura").addEventListener("click", async () => {
                        archivos_mensaje = []//limpiar
                        //actualziar seccion
                        document.querySelector(".ventana-archivos-mensaje-cuerpo-cuerpo").innerHTML = await mostrar_lista_archivos(archivos_mensaje)
                    })
                })
                //descargar archivos mensaje
                document.querySelectorAll(".archivo-mensaje-div-archivos").forEach(el => {
                    el.addEventListener("click", async (e) => {
                        e.preventDefault()
                        // COJER ID DEL ARCHIVO, PEDIR A MONGO LOS DATOS DE ESE ARCHIVO Y GUARDARLO EN LA UBICACION ESTABLECIDA
                        const id_archivo = el.dataset.id
                        const nombre_archivo = el.dataset.nombre
                        const resultado = await window.chats.DESCARGAR_ARCHIVO(id_archivo, nombre_archivo)
                        if (!resultado) {// fallo al descargar:notificar
                            window.pushNotificacion({
                                prioridad: 1,        // menor número = más importante
                                texto: `Fallo al cargar archivo: ${nombre_archivo}`,
                                tipo: "error"      // "info", "error", "success"
                            })
                        }
                    })
                })
            })
        })
    }
    catch (e) {
        throw e
    }
}
function scroll_fin_chat() {
    document.querySelector("#cuerpo-mensajes-chat").scrollTo({
        top: document.querySelector("#cuerpo-mensajes-chat").scrollHeight,
        behavior: "smooth"
    })
}
async function Actualizar_render_chat({ emisor, chat, mensaje, archivos, fecha }) {
    //chat, emisor son ids
    //el chat abierto es el del mensaje ?
    if (document.querySelector("#chat-usuario") && document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == chat) {
        //obtener datos necesarios para crear html mensaje
        const data = {
            emisor: emisor,
            data: fecha,
            contenido: [{
                asunto: mensaje,
                archivos: archivos
            }]
        }
        const [nombres_contactos, id_propio] = await Promise.all([
            window.social_usuario.OBTENER_CONTACTOS_USUARIO(),
            window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
        ])

        //crear mensaje
        const html = await crear_mensaje_html(data, id_propio, nombres_contactos)
        //insertar mensaje al final del chat
        document.querySelector("#cuerpo-mensajes-chat").insertAdjacentHTML("beforeend", html)
        //scroll hasta abajo donde esta el mensaje
        scroll_fin_chat()
    }
    else {
        console.log("dasda")
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
            window.ajustes_app.OBTENER_AJUSTES_APP("MSBienvenida"),
            window.cuenta_usuario.GET_APODO_SESION()
        ])
        if (ajustes_app.MSBienvenida) {
            window.pushNotificacion({
                prioridad: 0,        // menor número = más importante
                texto: `Benvido ${apodo} `,
                tipo: "info"      // "info", "error", "success"
            })
            //marcar como hecho para no volver a mostrarlo
            ajustes_app.MSBienvenida = false
            window.ajustes_app.GUARDAR_AJUSTES_APP(ajustes_app)
        }
    })()
    //iniciar buzón(asyncrono)
    try {
        // Preparar aviso de sincronización
        const syncBar = document.createElement("div")
        syncBar.className = "sync-mailbox-bar"
        syncBar.innerHTML = `<div class="sync-spinner"></div><span>Sincronizando buzón...</span>`

        // Solo mostrar si tarda más de 1 segundo (evita parpadeos en cargas rápidas)
        const mostrarSync = setTimeout(() => {
            document.body.appendChild(syncBar)
            requestAnimationFrame(() => syncBar.classList.add("visible"))
        }, 1000)

        const cambios = await window.buzonAPI.REVISAR_BUZON()
        await window.buzonAPI.INICIAR_BUZON()

        // Cancelar el temporizador o cerrar la barra si llegó a mostrarse
        clearTimeout(mostrarSync)
        if (syncBar.parentNode) {
            syncBar.classList.remove("visible")
            setTimeout(() => syncBar.remove(), 450)
        }
    } catch (e) {
        console.error(e)
    }



    //ajustes
    document.querySelector("#bt-seccion-menu-cuenta-ajustes").addEventListener("click", Todos_Los_Eventos_Funciones_Ajustes)
    //chat
    INICIO_CHAT_MENU_PRINCIPAL()

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

    //buzon API
    window.buzonAPI.onNuevaNotificacion(async (data) => {
        console.log("Notificación recibida:", data.entrada);
        //realizar cambios en la app segun la entrada del buzon
        for (const entrada of data.entrada) {
            await hacer_cambios_buzon(entrada)
        }
    });
    //realizar cambios en la app segun la entrada del buzon
    async function hacer_cambios_buzon(entrada) {
        //TODO: CAMBIO DE NOMBRE CHATGRUPO, AÑADIDO USUARIO A UN GRUPO, ELIMINADO USUARIO DE UN CHAT, MENSAJE ACTUALIZAR APP
        const tp = entrada.tipo
        if (tp === 0) { //mensaje chat
            /*Mirar si el usuario tiene abierto ese chat:
            si es asi actualizar chat
            sino mostrar notificacion e icono en el componente de la lista de chats de ese chat */
            /*entrada= { tipo, data: { id_chat, id_mensaje }}*/
            if (document.querySelector("#chat-usuario") && document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == entrada.data.chat) {
                const respuesta = await window.chats.OBTENER_DATOS_MENSAJE(entrada.data.chat, entrada.data.id_mensaje)
                //actualizar chat
                Actualizar_render_chat({
                    emisor: respuesta.emisor,
                    chat: entrada.data.chat,
                    mensaje: respuesta.contenido.asunto,
                    archivos: respuesta.contenido.archivos,
                    fecha: respuesta.data
                })
            }
            else {
                //cojer nombre del chat
                for (const chatC of document.querySelectorAll(".chat-componente-lista-chats")) {
                    if (chatC.dataset.id == entrada.chat) {
                        const nombre = chatC.querySelector(".nombre-chat-lista-componente span").textContent
                        //refrescar componente chat
                        refrescar_componente_lista_chats(entrada.chat, chatC, true)

                        //notificacion
                        window.pushNotificacion({
                            prioridad: 0, // menor número = más importante
                            texto: `Nuevo mensaje de ${nombre}`,
                            tipo: "info" // "info", "error", "success"
                        })
                    }
                }
            }
        }
        else if (tp === 1) {// añadido en un chat existente
            //actualizar componentes lista
            await ACTUALIZAR_LISTAS_CHAT()
            //buscar nombre del chat, como se supone que es grupal pues con buscarlo en mongodb en la tabla de chats globales llega
            const nombreChat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat })
            //notificacion
            //si el usuario es a quien añadieron
            if (entrada.data.usuarios.includes(await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO())) {
                window.pushNotificacion({
                    prioridad: 0, // menor número = más importante
                    texto: `Te has unido a un nuevo chat${nombreChat ? `\n${nombreChat}` : ``}`,
                    tipo: "info" // "info", "error", "success"
                })
            }
            else {
                const nombreEmisor = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.emisor })
                const nombreAñadido = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.añadido })
                window.pushNotificacion({
                    prioridad: 0, // menor número = más importante
                    texto: `${nombreEmisor} añadio a ${nombreAñadido} al grupo${nombreChat ? `\n${nombreChat}` : ``}`,
                    tipo: "info" // "info", "error", "success"
                })
            }
        }
        else if (tp === 2) {//chat nuevo
            //actualizar componentes lista
            await ACTUALIZAR_LISTAS_CHAT()
            //buscar nombre del chat, puede ser no grupal
            const nombreChat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat })
            const nombreCreador = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.creador })
            //notificacion
            window.pushNotificacion({
                prioridad: 0, // menor número = más importante
                texto: `${nombreCreador} ha creado un nuevo chat${nombreChat ? `\n${nombreChat}` : ``}`,
                tipo: "info" // "info", "error", "success"
            })
        }
        else if (tp === 3) {//cambio nombre chat

        }
        else if (tp === 4) {//quitado de un chat

        }
        else if (tp === 5) {//actualizar app

        }
    }
})

//TODO: REVISAR SI ESTA FUNCION PUEDE UTILIZAR UNA FUNCION PARA GENERAR LOS DATOS PARA CREAR EL HML, YA QUE EN OTRAS PARTES DEL CODIGO SE HACEN COSAS SIMIALRES
async function refrescar_componente_lista_chats(id_chat, componente, notificacion) {
    try {
        // Obtener datos globales del chat (nombre, usuarios, etc)
        // El usuario pide usar obtener_datos_chats (vía bridge OBTENER_DATOS_CHATS_GRUPALES)
        const [info_chats, lista_usuario, id_propio, lista_contactos] = await Promise.all([
            window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: [{ id: id_chat }], grupales: null, mensajes: false }),
            window.chats.OBTENER_CHATS_USUARIO(),
            window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO(),
            window.social_usuario.OBTENER_CONTACTOS_USUARIO()
        ])

        const info_chat = info_chats[0]
        if (!info_chat) return

        // Obtener la entrada específica de este chat para el usuario (ultimoCambio, ultimomensaje)
        const chat_usuario = lista_usuario.find(c => (c.id || c._id) == id_chat)

        // Calcular el nombre (extraído de ACTUALIZAR_LISTAS_CHAT)
        let nombre = ""
        if (info_chat.grupo) {
            nombre = info_chat.nombre
        } else {
            const id_otro = info_chat.usuarios.find(x => x != id_propio)
            if (!id_otro) {
                nombre = "<<error integrantes>>"
            } else {
                const indice_contacto = lista_contactos.findIndex(x => x.id == id_otro)
                if (indice_contacto == -1) {
                    const datos_externos = await window.social_usuario.OBTENER_DATOS_USUARIO_EXTERNO(id_otro, "apodo")
                    nombre = "~" + (datos_externos?.apodo || "no encontrado")
                } else {
                    nombre = lista_contactos[indice_contacto].apodo
                }
            }
        }

        // Construir objeto de datos para la estructura HTML
        const datos_usar = {
            id: id_chat,
            ultimoCambio: chat_usuario?.ultimoCambio,
            usuarios: info_chat.usuarios,
            nombre: nombre,
            ultimomensaje: chat_usuario?.ultimomensaje
        }

        // Generar el nuevo HTML
        const html_nuevo = chat_componente_lista_structura_html(datos_usar)

        // Actualizar el componente existente sin perder la referencia (para no perder el event listener)
        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = html_nuevo
        const contenido_nuevo = tempDiv.firstElementChild.innerHTML

        componente.innerHTML = contenido_nuevo

        // Si hay notificación, podemos añadir una clase visual (ej: brillo o punto azul)
        if (notificacion) {
            componente.classList.add("nuevo-mensaje-notificacion")
            // Opcional: quitar la clase tras unos segundos o al hacer click
        }

    } catch (e) {
        console.error("Error al refrescar componente de chat:", e)
    }
}

async function Encontrar_Nombre_Chat_Usuario({ id_buscar, grupal = true }) {
    //si grupal: false->es un usuario, true->puede ser un chat grupal
    if (grupal) {
        //buscar en tabla general de chats
        const chat_grupal = await window.chats.OBTENER_DATOS_CHAT_UNICO(id_buscar, "nombre")
        if (chat_grupal?.nombre) return chat_grupal.nombre
        //como no existe, puede ser un usuario
    }
    //1ºbuscar en contactos apodo, 2º buscar en usuarios su nombre


    return null
}