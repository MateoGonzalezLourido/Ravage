//No mostrar el login si este ya tiene sesion iniciada con autolog
async function preload_pag() {
    if (window.boot.isLogged) {
        await window.paginas_app.CAMBIAR_PAGINA_HOME()//mandar al home
    } else {
        mostrar_menu_sesion(true)
    }
}
preload_pag()
let intentos = 5;
let username_g;
async function form_validar_correo_registro(e) {
    e.preventDefault()

    if (intentos > 0) {
        const codigo = document.querySelector("#bt-code-introducir").value
        const esValido = await window.validadores.VALIDAR_CODIGO(codigo)
        if (esValido) result = await window.sesion_usuario.VALIDAR_CODE_REGISTRAR_USUARIO(username_g, codigo);
        else result = { success: false, message: "Código no válido (debe tener 6 números)" }

        if (result.success) {//codigo valido
            console.log("SE HA CREADO EL USUARIO CORRECTAMENTE")
            //mostrar menu de confirmacion cuenta creada
            mostrar_menu_validation_code(false)
            mostrar_menu_cuenta_creada(true)
        }
        else {//TODO:mostrar errores en el html
            intentos--;
            document.querySelector("#text-error-form-causa-codigo-validar").innerHTML = `* Código incorrecto: ${intentos}intentos restantes*`
            document.querySelector("#text-error-form-causa-codigo-validar").classList.remove("ocultar-display")
            document.querySelector("#text-error-form-causa-codigo-validar").classList.add("flex-display")
        }
    }
}
async function form_validar_correo(e) {
    e.preventDefault()
    if (intentos > 0) {
        const codigo = document.querySelector("#bt-code-introducir").value
        const esValido = await window.validadores.VALIDAR_CODIGO(codigo)
        if (esValido) result = await window.sesion_usuario.VALIDAR_CODE_LOGIN_USUARIO(username_g, codigo);
        else result = { success: false, message: "Código no válido (debe tener 6 números)" }

        if (result.success) {//codigo valido
            console.log("SE HA INICIADO SESION CORRECTAMENTE")
            //mostrar menu de confirmacion cuenta creada
            mostrar_menu_validation_code(false)
            await window.paginas_app.CAMBIAR_PAGINA_HOME()//mandar al home

            document.querySelector("#bt-volver-login-confirmacion-cuenta").addEventListener("click", (e) => {
                e.preventDefault()
                mostrar_menu_sesion(false)
                window.sesion_usuario.BORRAR_CODES_VALIDACION_CORREO(username_g)
            })
        }
        else {//TODO:mostrar errores en el html
            if (result.bloqueador) return;
            intentos--;
            document.querySelector("#text-error-form-causa-codigo-validar").innerHTML = `* Código incorrecto: ${intentos}intentos restantes*`
            document.querySelector("#text-error-form-causa-codigo-validar").classList.remove("ocultar-display")
            document.querySelector("#text-error-form-causa-codigo-validar").classList.add("flex-display")
        }
    }
}
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
    document.querySelector("#bt-code-introducir").value = ""//limpiar input

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
    document.querySelector("#bt-cambiar-registro").addEventListener("click", (e) => {
        e.preventDefault()
        mostrar_menu_log(false)
        mostrar_menu_reg(true)
    })
    //cambiar registro a login
    document.querySelector("#bt-cambiar-login").addEventListener("click", (e) => {
        e.preventDefault()
        mostrar_menu_reg(false)
        mostrar_menu_log(true)
    })
    //login
    document.querySelector("#form-login").addEventListener("submit", async (e) => {
        document.querySelector("#form-validation-correo").removeEventListener('submit', form_validar_correo)
        document.querySelector("#form-validation-correo").removeEventListener('submit', form_validar_correo_registro)

        e.preventDefault()
        const username = document.querySelector('#login-user').value.trim()
        const password = document.querySelector('#login-pass').value.trim()
        const mantener_sesion_iniciada = document.querySelector("#login-guardar").checked

        // Validaciones frontend
        if (!(await window.validadores.VALIDAR_CORREO(username))) {
            document.querySelector("#text-error-form-causa-login").innerHTML = "*Correo no válido*"
            document.querySelector("#text-error-form-causa-login").classList.remove("ocultar-display")
            return;
        }
        if (!(await window.validadores.VALIDAR_CONTRASEÑA(password))) {
            document.querySelector("#text-error-form-causa-login").innerHTML = "*Contraseña no válida (mín. 8 caracteres)*"
            document.querySelector("#text-error-form-causa-login").classList.remove("ocultar-display")
            return;
        }
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
                intentos = 5
                username_g = username
                document.querySelector("#form-validation-correo").addEventListener('submit', form_validar_correo)
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
    function cambiar_login_menu(e){
e.preventDefault()
        mostrar_menu_validation_code(false)
        mostrar_menu_reg(false)
        mostrar_menu_log(true)
    }
    document.querySelector("#bt-cambiar-login-validation-code").addEventListener("click", cambiar_login_menu)
    //login-pagina soporte cambiar
    document.querySelector("#bt-cambiar-contraseña-login").addEventListener("click", (e) => {
        e.stopPropagation()
        window.paginas_app.CAMBIAR_PAGINA_SOPORTE()//cambiar a pagina de soporte
    })
    //registro
    document.querySelector("#form-registro").addEventListener('submit', async (e) => {
        e.preventDefault()
        document.querySelector("#bt-cambiar-login-validation-code").removeEventListener("click", cambiar_login_menu)
        document.querySelector("#form-validation-correo").removeEventListener('submit', form_validar_correo_registro)
        document.querySelector("#form-validation-correo").removeEventListener('submit', form_validar_correo)

        let apodo = document.querySelector('#registro-apodo').value.trim()
        const username = document.querySelector('#registro-user').value.trim()
        const password = document.querySelector('#registro-pass').value.trim()
        const password_confirm = document.querySelector('#registro-pass-confirm').value.trim()

        // Validaciones frontend
        if (apodo !== "" && !(await window.validadores.VALIDAR_APODO(apodo))) {
            document.querySelector("#text-error-form-causa-registro").innerHTML = "*Apodo no válido*"
            document.querySelector("#text-error-form-causa-registro").classList.remove("ocultar-display")
            return;
        }
        if (!(await window.validadores.VALIDAR_CORREO(username))) {
            document.querySelector("#text-error-form-causa-registro").innerHTML = "*Correo no válido*"
            document.querySelector("#text-error-form-causa-registro").classList.remove("ocultar-display")
            return;
        }
        if (!(await window.validadores.VALIDAR_CONTRASEÑA(password))) {
            document.querySelector("#text-error-form-causa-registro").innerHTML = "*Contraseña no válida (mín. 8 caracteres)*"
            document.querySelector("#text-error-form-causa-registro").classList.remove("ocultar-display")
            return;
        }

        if (!(password === password_confirm)) {//las dos contraseñas son diferentes
            document.querySelector("#registro-pass-confirm").classList.add("estrada-menu-registro-login-incorrecto")
            document.querySelector("#span-repetir-contraseña").classList.add("estrada-menu-registro-login-incorrecto")
            document.querySelector("#text-error-form-causa-registro").innerHTML = "*Las contraseñas no coinciden*"
            document.querySelector("#text-error-form-causa-registro").classList.remove("ocultar-display")
            return;
        }
        document.querySelector("#registro-pass-confirm").classList.remove("estrada-menu-registro-login-incorrecto")
        document.querySelector("#span-repetir-contraseña").classList.remove("estrada-menu-registro-login-incorrecto")

        //Conectar con backend
        let result = await window.sesion_usuario.REGISTRAR_USUARIO(apodo, username, password);

        if (result.success) {//datos validos: validar codigo de correo
            mostrar_menu_log(false)
            mostrar_menu_reg(false)
            document.querySelector("#text-error-form-causa-codigo-validar").classList.remove("flex-display")
            document.querySelector("#text-error-form-causa-codigo-validar").classList.add("ocultar-display")
            mostrar_menu_validation_code(true)
            function cambiar_login_validation_code(e) {
                e.preventDefault()
                mostrar_menu_validation_code(false)
                mostrar_menu_log(false)
                mostrar_menu_reg(true)
                window.sesion_usuario.BORRAR_CODES_VALIDACION_CUENTA(username)
            }
            document.querySelector("#bt-cambiar-login-validation-code").addEventListener("click", cambiar_login_validation_code)
            intentos = 5;//esto se define en backend
            username_g = username
            document.querySelector("#form-validation-correo").addEventListener('submit', form_validar_correo_registro)
        }
        else {//TODO:mostrar errores en el html
            if (result.bloqueador) return;
            console.log("ERROR AL REGISTRAR USUARIO")
            document.querySelector("#text-error-form-causa-registro").innerHTML = "*" + result.message + "*"
            document.querySelector("#text-error-form-causa-registro").classList.remove("ocultar-display")
            document.querySelector("#text-error-form-causa-registro").classList.add("flex-display")
        }
    })
    document.querySelector("#bt-volver-login-confirmacion-cuenta").addEventListener("click", (e) => {
        e.preventDefault()
        mostrar_menu_cuenta_creada(false)
        mostrar_menu_reg(false)
        mostrar_menu_log(true)
    })
})

window.sesion_usuario.ICONO_CARGANDO((mostrar) => {
    const clase_sync_bar="sync-mailbox-bar"
    if(mostrar){
        if(!document.querySelector(`.${clase_sync_bar}`)){
    const syncBar = document.createElement("div")
    syncBar.className = clase_sync_bar
    syncBar.innerHTML = `<div class="sync-spinner"></div><span>Procesando...</span>`
document.body.appendChild(syncBar)
        requestAnimationFrame(() => syncBar.classList.add("visible"))
        }
    }
    else{
        document.querySelector(`.${clase_sync_bar}`)?.classList.remove("visible")
        setTimeout(() => document.querySelector(`.${clase_sync_bar}`)?.remove(), 450)
    }
    
})