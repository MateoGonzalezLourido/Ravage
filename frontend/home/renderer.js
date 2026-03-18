//importar componentes js
import { desplegar_menu_añadir_chat } from './ui/añadir_chats_usuarios.js'
import { url_icono_extension_img } from './ui/url_icono_extensiones_archivos.js'
import { chat_componente_lista_estructura_html, crear_mensaje_html, Crear_chat_html, mostrar_datos_chat_usaurios } from './ui/chat.js'

let archivos_mensaje = []//{ruta,nombre,extension}
let archivo_cambiando_nombre; //es para guardar el archivo que se esta editando ya
//TODO:ajustes refactorizar
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
            if (fecha_bloqueo_apodo != "") document.querySelector("#bt-fecha-bloqueo-apodo").innerHTML = `*Bloqueado: ${fecha_bloqueo_apodo}`
            if (fecha_bloqueo_correo != "") document.querySelector("#bt-fecha-bloqueo-correo").innerHTML = `*Bloqueado: ${fecha_bloqueo_correo}`
            if (fecha_bloqueo_contraseña != "") document.querySelector("#bt-fecha-bloqueo-contraseña").innerHTML = `*Bloqueado: ${fecha_bloqueo_contraseña}`
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
function scroll_fin_chat() {
    document.querySelector("#cuerpo-mensajes-chat").scrollTo({
        top: document.querySelector("#cuerpo-mensajes-chat").scrollHeight,
        behavior: "smooth"
    })
}
async function ACTUALIZAR_LISTAS_CHAT() {
    try {
        archivo_cambiando_nombre = null
        const [lista_chats, lista_contactos] = await Promise.all([
            window.chats.OBTENER_CHATS_USUARIO(),
            window.social_usuario.OBTENER_CONTACTOS_USUARIO()
        ])
        window.chats.LIMPIAR_MENSAJES_CHATS_ANTIGUOS(lista_chats)//!importante: esto hay que hacerlo asincrono porque puede tardar mucho, no importa que el usaurio pueda ver mensajes de hace un año, esto se hace para limpiar el DB

        const [datos_chats_grupales, id_propio] = await Promise.all([
            window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: lista_chats, grupales: null, mensajes: false }),
            window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
        ])

        //crear html lista chats
        const map_grupales = {}
        if (Array.isArray(datos_chats_grupales)) {
            datos_chats_grupales.forEach(chat => {
                if (chat) map_grupales[chat.id || chat._id] = chat
            })
        }

        // ORDENAR LOS CHATS POR ULTIMO CAMBIO (El más reciente arriba)
        const lista_chats_ordenada = [...lista_chats].sort((a, b) => {
            return new Date(b.ultimoCambio) - new Date(a.ultimoCambio)
        })

        const html = lista_chats_ordenada
            .map(c => {
                const chatEx = map_grupales[c.id] || {}
                const nombre = chatEx.nombre || "Chat sin nombre"
                const datos_usar = { id: c.id, ultimoCambio: c.ultimoCambio, usuarios: chatEx.usuarios || [], nombre: nombre, ultimomensaje: c.ultimomensaje }
                return chat_componente_lista_estructura_html(datos_usar)
            })
            .join("")

        document.querySelector("#lista-chats-componentes").innerHTML = html
        
        //eventos doom
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

                // El nombre ya viene resuelto por el backend
                datos_chat._id = id
                //limpiar residuos de otros chats
                archivos_mensaje = []
                document.querySelector("#chat-usuario").innerHTML = await Crear_chat_html(datos_chat, id_usuario)
                //cerrar paneles laterales si están abiertos
                cerrar_paneles_al_abrir_chat()
                //scroll al final
                scroll_fin_chat()
                //TODO::crear observadores doom para el sistema de fecha de bloques mensajes
                const elementos = document.querySelectorAll(".fecha-bloque-mensajes");
                const fixed_text = "text-fecha-bloques-mensajes-fixed"
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        const html = entry.target.querySelector("span")?.innerHTML || entry.target.innerHTML;
                        if (entry.isIntersecting) {
                            // Si el bloque es visible, quitamos el flotante que coincida con su texto
                            const flotantes = document.querySelectorAll(`.${fixed_text}`);
                            flotantes.forEach(f => {
                                if (f.querySelector("span")?.innerHTML === html) f.remove();
                            });
                        } else {
                            // Cuando el bloque deja de verse por arriba (boundingClientRect.top < 0)
                            if (entry.boundingClientRect.top < 0 && !html.includes("Hoy")) {
                                mostrarFechaBloqueMensajes(html);
                            }
                        }
                    });
                }, { threshold: [0, 1] });

                elementos.forEach(el => observer.observe(el));

                function mostrarFechaBloqueMensajes(html) {
                    const contenedor = document.querySelector("#chat-usuario");
                    // Evitar duplicados del mismo texto
                    if (Array.from(document.querySelectorAll(`.${fixed_text} span`)).some(s => s.innerHTML === html)) return;

                    const hijo = document.createElement("div");
                    const text = document.createElement("span");
                    text.innerHTML = html;
                    hijo.appendChild(text);
                    hijo.classList.add(fixed_text);
                    contenedor.appendChild(hijo);
                }

                //otros eventos
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
                                tipo: "error"
                            })
                        } else {
                            window.pushNotificacion({
                                prioridad: 1,        // menor número = más importante
                                texto: `Descarga completa: ${nombre_archivo}`,
                                tipo: "success"
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

async function Actualizar_render_chat({ emisor, chat, mensaje = "", archivos = [], fecha, especial = null, data = {} }) {
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

async function refrescar_componente_lista_chats(id_chat, componente, notificacion = false) {
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

        // Construir objeto de datos para la estructura HTML
        const datos_usar = {
            id: id_chat,
            ultimoCambio: chat_usuario?.ultimoCambio,
            usuarios: info_chat.usuarios,
            nombre: info_chat.nombre, // Ya viene resuelto por el backend
            ultimomensaje: chat_usuario?.ultimomensaje
        }

        // Generar el nuevo HTML
        const html_nuevo = chat_componente_lista_estructura_html(datos_usar)

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

//COMPROBAR SI ES EL USUARIO DE LA SESION
async function Es_usuario_Sesion(usuario_comprobar) {
    const id_mio = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
    return usuario_comprobar === id_mio
}

//buzon api
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
        //actualizar chat
        Actualizar_render_chat({
            emisor: entrada.data.emisor,
            chat: entrada.data.chat,
            fecha: entrada.data.data,
            especial: 1,
            data: entrada.data
        })
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
    else if (tp === 4) {//expulsado de un chat
        const expulsadoId = entrada.data.expulsado;
        const isMe = await Es_usuario_Sesion(expulsadoId);
        const nombreExpulsado = isMe ? "Te" : await Encontrar_Nombre_Chat_Usuario({ id_buscar: expulsadoId });
        const chatNombre = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat });

        if (isMe) {
            await ACTUALIZAR_LISTAS_CHAT();
            if (document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == entrada.data.chat) {
                document.querySelector("#chat-usuario").innerHTML = "";
            }
            window.pushNotificacion({
                prioridad: 0,
                texto: `Has sido expulsado del chat ${chatNombre || ""}`,
                tipo: "error"
            });
        } else {
            window.pushNotificacion({
                prioridad: 1,
                texto: `${nombreExpulsado} ha sido expulsado del chat ${chatNombre || ""}`,
                tipo: "info"
            });
        }
        //actualizar chat
        Actualizar_render_chat({
            emisor: entrada.data.emisor,
            chat: entrada.data.chat,
            fecha: entrada.data.data,
            especial: 1,
            data: entrada.data
        })
    }
    else if (tp === 5) {//actualizar app

    }
}
async function mensaje_bienvenida_usuario() {
    // Obtener ajuste que guarda si se ha enviado el mensaje de bienvenida y apodo simultáneamente
    const [ajustes_app, apodo] = await Promise.all([
        window.ajustes_app.OBTENER_AJUSTES_APP("MSBienvenida"),
        window.cuenta_usuario.GET_APODO_SESION()
    ])
    //mandar notificacion si es la primera vez
    if (ajustes_app.MSBienvenida) {
        window.pushNotificacion({
            prioridad: 0,
            texto: `Benvido ${apodo} `,
            tipo: "info"
        })

        //marcar como hecho en ajustes para no volver a mostrarlo
        ajustes_app.MSBienvenida = false
        window.ajustes_app.GUARDAR_AJUSTES_APP(ajustes_app)
    }
}

async function iniciar_buzonAPI() {
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
    //TODO: hacer los cambios de la primera leida del buzon

    await window.buzonAPI.INICIAR_BUZON()

    // Cancelar el temporizador o cerrar la barra si llegó a mostrarse
    clearTimeout(mostrarSync)
    if (syncBar.parentNode) {
        syncBar.classList.remove("visible")
        setTimeout(() => syncBar.remove(), 450)
    }
}
//cargar eventos de la pagina
document.addEventListener("DOMContentLoaded", async () => {
    //mensaje bienvenida (solo si es la primera vez que se une)
    mensaje_bienvenida_usuario().catch(e => console.error("Error al cargar mensaje de bienvenida", e))

    //cargar eventos doom

    //evento ajustes
    document.querySelector("#bt-seccion-menu-cuenta-ajustes").addEventListener("click", Todos_Los_Eventos_Funciones_Ajustes)

    //cargar chat
    INICIO_CHAT_MENU_PRINCIPAL()

    //añadir chat
    document.querySelector("#bt-añadir-chat").addEventListener("click", (e) => desplegar_menu_añadir_chat({ e, mostrar: true }))

    //iniciar buzón api
    iniciar_buzonAPI().catch(e => console.error("Error al iniciar buzón api", e))
    //buzon API
    window.buzonAPI.onNuevaNotificacion(async (data) => {
        //realizar cambios en la app segun la entrada del buzon
        for (const entrada of data.entrada) await hacer_cambios_buzon(entrada)
    });

})