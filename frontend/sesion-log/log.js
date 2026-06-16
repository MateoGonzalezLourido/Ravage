import { optimizar_ventana } from '../global/optimizar_ventana.js';
optimizar_ventana()
// --- Cache DOM Elements ---
let elements;

// --- State and Config ---
let intentos = 5;
let username_g;
let dpConfianzaListenersAdded = false;

// --- Initialization ---
async function preload_pag() {
    elements = {
            seccionRoot: document.getElementById('seccion-registro-login'),
            seccionLogin: document.getElementById('seccion-login'),
            seccionRegistro: document.getElementById('seccion-registro'),
            seccionValidacion: document.getElementById('seccion-validacion-codigo-correo'),
            seccionConfirmacion: document.getElementById('seccion-confirmacion-cuenta-creada'),

            formLogin: document.getElementById('form-login'),
            formRegistro: document.getElementById('form-registro'),
            formValidacion: document.getElementById('form-validation-correo'),

            inputLoginUser: document.getElementById('login-user'),
            inputLoginPass: document.getElementById('login-pass'),
            inputLoginGuardar: document.getElementById('login-guardar'),

            inputRegApodo: document.getElementById('registro-apodo'),
            inputRegUser: document.getElementById('registro-user'),
            inputRegPass: document.getElementById('registro-pass'),
            inputRegPassConfirm: document.getElementById('registro-pass-confirm'),

            inputCode: document.getElementById('bt-code-introducir'),

            errorLogin: document.getElementById('text-error-form-causa-login'),
            errorRegistro: document.getElementById('text-error-form-causa-registro'),
            errorValidacion: document.getElementById('text-error-form-causa-codigo-validar'),

            btnCambiarReg: document.getElementById('bt-cambiar-registro'),
            btnCambiarLog: document.getElementById('bt-cambiar-login'),
            btnCambiarLogValidation: document.getElementById('bt-cambiar-login-validation-code'),
            btnVolverLogin: document.getElementById('bt-volver-login-confirmacion-cuenta'),

            seccionDpConfianza: document.getElementById('seccion-dispositivo-confianza'),
            btnConfirmarDpConfianza: document.getElementById('bt-confirmar-dp-confianza'),
            btnRechazarDpConfianza: document.getElementById('bt-rechazar-dp-confianza'),

            syncBar: document.getElementById('sync-mailbox-bar'),
            spanRepetirPass: document.getElementById('span-repetir-contraseña')
        };
        mostrarSeccion(elements.seccionLogin);
        elements.inputLoginUser.focus();
}

// --- Menu Controls ---
function mostrarSeccion(seccionActiva) {
    // Esconder todas las secciones principales
    [elements.seccionLogin, elements.seccionRegistro, elements.seccionValidacion, elements.seccionConfirmacion, elements.seccionDpConfianza]
        .forEach(s => {
            s.classList.add('ocultar-display');
            s.classList.remove('flex-display');
        });

    // Mostrar la sección activa
    if (seccionActiva) {
        seccionActiva.classList.remove('ocultar-display');
        seccionActiva.classList.add('flex-display');
        elements.seccionRoot.classList.remove('ocultar-display');
        elements.seccionRoot.classList.add('flex-display');
    } else {
        elements.seccionRoot.classList.add('ocultar-display');
        elements.seccionRoot.classList.remove('flex-display');
    }
}

function mostrarError(element, mensaje) {
    if (!element) return;
    element.innerHTML = `*${mensaje}*`;
    element.classList.remove('ocultar-display');
    element.classList.add('flex-display');
}

function ocultarError(element) {
    if (!element) return;
    element.classList.add('ocultar-display');
    element.classList.remove('flex-display');
}

// --- Form Handlers ---
async function handleValidacionCode(e) {
    e.preventDefault();
    if (intentos <= 0) return;

    const codigo = elements.inputCode.value;
    const esValido = await window.validadores.VALIDAR_CODIGO(codigo);

    if (!esValido) {
        mostrarError(elements.errorValidacion, "Código no válido (debe tener 6 números)");
        return;
    }

    const isLogin = elements.formValidacion.dataset.mode === 'login';
    const result = isLogin
        ? await window.sesion_usuario.VALIDAR_CODE_LOGIN_USUARIO(username_g, codigo)
        : await window.sesion_usuario.VALIDAR_CODE_REGISTRAR_USUARIO(username_g, codigo);

    if (result.success) {
        if (isLogin) {
            mostrarSeccion(elements.seccionDpConfianza);
            elements.btnConfirmarDpConfianza.focus();
            if (!dpConfianzaListenersAdded) {
                dpConfianzaListenersAdded = true;
                elements.btnConfirmarDpConfianza.addEventListener('click', async () => {
                    elements.btnConfirmarDpConfianza.disabled = true;
                    elements.btnRechazarDpConfianza.disabled = true;
                    await window.sesion_usuario.MARCAR_DISPOSITIVO_CONFIANZA().catch(() => {});
                    await window.paginas_app.CAMBIAR_PAGINA_HOME();
                });
                elements.btnRechazarDpConfianza.addEventListener('click', async () => {
                    await window.paginas_app.CAMBIAR_PAGINA_HOME();
                });
            }
        } else {
            mostrarSeccion(elements.seccionConfirmacion);
            elements.btnVolverLogin.focus();
        }
    } else {
        if (result.bloqueador) return;
        intentos--;
        mostrarError(elements.errorValidacion, `Código incorrecto: ${intentos} intentos restantes`);
    }
}

// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
    preload_pag();

    // Swapping between login/register
    elements.btnCambiarReg.addEventListener("click", (e) => {
        e.preventDefault();
        mostrarSeccion(elements.seccionRegistro);
        elements.inputRegApodo.focus();
    });

    elements.btnCambiarLog.addEventListener("click", (e) => {
        e.preventDefault();
        mostrarSeccion(elements.seccionLogin);
        elements.inputLoginUser.focus();
    });

    elements.btnCambiarLogValidation.addEventListener("click", (e) => {
        e.preventDefault();
        mostrarSeccion(elements.seccionLogin);
        elements.inputLoginUser.focus();
    });

    elements.btnVolverLogin.addEventListener("click", (e) => {
        e.preventDefault();
        mostrarSeccion(elements.seccionLogin);
    });

    // Forms
    elements.formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        ocultarError(elements.errorLogin);

        const username = elements.inputLoginUser.value.trim();
        const password = elements.inputLoginPass.value.trim();
        const persistir = elements.inputLoginGuardar.checked;

        if (!(await window.validadores.VALIDAR_CORREO(username))) {
            mostrarError(elements.errorLogin, "Correo no válido");
            return;
        }
        if (!(await window.validadores.VALIDAR_CONTRASEÑA(password))) {
            mostrarError(elements.errorLogin, "Contraseña no válida (mín. 8 caracteres)");
            return;
        }

        const result = await window.sesion_usuario.LOGIN_USUARIO(username, password, persistir);

        if (result.success) {
            if (result.autoverificacion) {
                await window.paginas_app.CAMBIAR_PAGINA_HOME();
            } else {
                username_g = username;
                intentos = 5;
                elements.formValidacion.dataset.mode = 'login';
                elements.inputCode.value = "";
                ocultarError(elements.errorValidacion);
                mostrarSeccion(elements.seccionValidacion);
                elements.inputCode.focus();
            }
        } else {
            if (result.bloqueador) return;
            mostrarError(elements.errorLogin, result.message);
        }
    });

    elements.formRegistro.addEventListener("submit", async (e) => {
        e.preventDefault();
        ocultarError(elements.errorRegistro);

        const apodo = elements.inputRegApodo.value.trim();
        const username = elements.inputRegUser.value.trim();
        const password = elements.inputRegPass.value.trim();
        const confirm = elements.inputRegPassConfirm.value.trim();

        if (apodo && !(await window.validadores.VALIDAR_APODO(apodo))) {
            mostrarError(elements.errorRegistro, "Apodo no válido");
            return;
        }
        if (!(await window.validadores.VALIDAR_CORREO(username))) {
            mostrarError(elements.errorRegistro, "Correo no válido");
            return;
        }
        if (!(await window.validadores.VALIDAR_CONTRASEÑA(password))) {
            mostrarError(elements.errorRegistro, "Contraseña no válida (mín. 8 caracteres)");
            return;
        }
        if (password !== confirm) {
            elements.inputRegPassConfirm.classList.add("estrada-menu-registro-login-incorrecto");
            elements.spanRepetirPass.classList.add("estrada-menu-registro-login-incorrecto");
            mostrarError(elements.errorRegistro, "Las contraseñas no coinciden");
            return;
        }

        elements.inputRegPassConfirm.classList.remove("estrada-menu-registro-login-incorrecto");
        elements.spanRepetirPass.classList.remove("estrada-menu-registro-login-incorrecto");

        const result = await window.sesion_usuario.REGISTRAR_USUARIO(apodo, username, password);

        if (result.success) {
            username_g = username;
            intentos = 5;
            elements.formValidacion.dataset.mode = 'registro';
            elements.inputCode.value = "";
            ocultarError(elements.errorValidacion);
            mostrarSeccion(elements.seccionValidacion);
            elements.inputCode.focus();
        } else {
            if (result.bloqueador) return;
            mostrarError(elements.errorRegistro, result.message);
        }
    });

    elements.formValidacion.addEventListener("submit", handleValidacionCode);


    // --- External Handlers ---
    window.avisos_ui.ICONO_CARGANDO((mostrar) => {
        if (mostrar) {
            elements.syncBar.classList.add("visible");
        } else {
            elements.syncBar.classList.remove("visible");
        }
    });

    window.avisos_ui.FALLO_CORREO_MANDAR(() => {
        window.pushNotificacion({
            prioridad: 0,
            texto: `Fallo al enviar correo`,
            tipo: "error"
        });
    });

    // 4. Asegurar que todas las imágenes existentes no sean arrastrables
    document.querySelectorAll('img').forEach(img => img.draggable = false);
});

// ==========================================
// PREVENCIÓN GLOBAL DE ARRASTRE DE IMÁGENES
// ==========================================
document.addEventListener("dragstart", (e) => {
    if (e.target.tagName === 'IMG') {
        e.preventDefault();
    }
});

