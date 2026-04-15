export let bloquear_span_cambio_contraseña = false;
export let bloquear_span_cambio_apodo = false;
export let bloquear_span_cambio_correo = false;
import { escapeHTML } from './seguridad_ui.js';


const formatoScroollAnimacion = {
    behavior: "smooth",
    block: "start"
};

/**
 * Initializes all event listeners and state for the settings page.
 */
// Flag to prevent multiple event attachments
let ajustesEventosInicializados = false;

export async function Todos_Los_Eventos_Funciones_Ajustes(e) {
    if (e) e.preventDefault();

    // Initial UI state
    cerrar_cuerpos_ajustes("cuenta");
    const menuAjustes = document.querySelector("#seccion-menu-cuenta-ajustes");
    menuAjustes.classList.remove("ocultar-display");
    menuAjustes.classList.add("flex-display");

    if (ajustesEventosInicializados) {
        await cargar_ajustes_cache();
        return;
    }

    // Event Delegation or centralized binding
    const bindings = [
        { id: "#bt-menu-navegacion-ajustes-cuenta", section: "cuenta", scroll: "#cuerpo-ajustes-cuenta" },
        { id: "#bt-menu-navegacion-ajustes-general", section: "general", scroll: "#cuerpo-ajustes-general" },
        { id: "#bt-menu-navegacion-ajustes-noti", section: "notificaciones", scroll: "#cuerpo-ajustes-noti" },
        { id: "#bt-menu-navegacion-ajustes-soporte", section: "soporte", scroll: "#cuerpo-ajustes-soporte" },
        { id: "#bt-menu-navegacion-ajustes-saber", section: "saber mas", scroll: "#cuerpo-ajustes-saber" }
    ];

    bindings.forEach(binding => {
        const btn = document.querySelector(binding.id);
        if (!btn) return;

        btn.addEventListener("click", (e) => {
            e.preventDefault();

            // UI feedback for active tab
            document.querySelectorAll("#seccion-menu-cuenta-ajustes .menu-navegacion-ajustes div").forEach(d => d.classList.remove("active"));
            btn.classList.add("active");

            cerrar_cuerpos_ajustes(binding.section);
            document.querySelector(binding.scroll).scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    ajustesEventosInicializados = true;

    document.querySelector("#bt-cerrar-menu-ajustes").addEventListener("click", cerrar_ajustes_pagina);
    document.querySelector("#bt-cerrar-sesion").addEventListener("click", cerrar_sesion_bt);
    document.querySelector("#bt-cambiar-contraseña").addEventListener("click", funcion_cambiar_contraseña);
    document.querySelector("#bt-cambiar-apodo").addEventListener("click", funcion_cambiar_apodo);
    document.querySelector("#bt-cambiar-correo").addEventListener("click", funcion_cambiar_correo);
    document.querySelector("#bt-ver-chats-silenciados").addEventListener("click", ver_chats_silenciados);
    document.querySelector("#bt-ver-chats-bloqueados").addEventListener("click", ver_chats_bloqueados);

    // INICIAR CACHE SETTINGS
    await cargar_ajustes_cache();
    setup_cache_listeners();
    document.querySelector("#bt-cerrar-menu-cambio-data").addEventListener("click", (e) => {
        e.preventDefault();
        const menuCambio = document.querySelector("#alineador-menu-cambiar-data-cuenta");
        menuCambio.classList.remove("flex-display");
        menuCambio.classList.add("ocultar-display");
        document.querySelector("#cambio-pass").value = "";
        document.querySelector("#cambio-pass-confirm").value = "";
    });
}

// --- UI Management ---

async function cerrar_cuerpos_ajustes(no_cerrar) {
    const sectionMap = {
        "cuenta": "cuenta",
        "general": "general",
        "notificaciones": "noti",
        "soporte": "soporte",
        "saber mas": "saber"
    };

    for (const [key, idSuffix] of Object.entries(sectionMap)) {
        const el = document.querySelector(`#cuerpo-ajustes-${idSuffix}`);
        if (no_cerrar === key) {
            el.classList.remove("ocultar-display");
            el.classList.add("flex-display");
            if (key === "cuenta") await actualizar_datos_cuenta();
        } else {
            el.classList.remove("flex-display");
            el.classList.add("ocultar-display");
        }
    }
}

async function actualizar_datos_cuenta() {
    const [fecha_creacion, fecha_bloqueo_apodo, fecha_bloqueo_correo, fecha_bloqueo_contraseña, apodo, correo] = await Promise.all([
        window.cuenta_usuario.OBTENER_FECHA_CREACION_CUENTA(),
        window.cuenta_usuario.OBTENER_FECHA_BLOQUEO_APODO(),
        window.cuenta_usuario.OBTENER_FECHA_BLOQUEO_CORREO(),
        window.cuenta_usuario.OBTENER_FECHA_BLOQUEO_CONTRASEÑA(),
        window.cuenta_usuario.GET_APODO_SESION(),
        window.cuenta_usuario.OBTENER_CORREO_USUARIO()
    ]);

    document.querySelector("#text-cuenta-apodo").innerHTML = `Apodo: <font color="#E53612">${escapeHTML(apodo)}</font>`;
    document.querySelector("#text-cuenta-correo").innerHTML = `Correo electrónico: <font color="#E53612">${escapeHTML(correo)}</font>`;
    document.querySelector("#text-cuenta-creada-fecha").innerHTML = `*Cuenta creada el ${escapeHTML(fecha_creacion)}`;

    const setLockText = (id, date) => {
        const el = document.querySelector(id);
        el.innerHTML = date ? `*Bloqueado: ${date}` : "";
    };

    setLockText("#bt-fecha-bloqueo-apodo", fecha_bloqueo_apodo);
    setLockText("#bt-fecha-bloqueo-correo", fecha_bloqueo_correo);
    setLockText("#bt-fecha-bloqueo-contraseña", fecha_bloqueo_contraseña);
}

function cerrar_ajustes_pagina(e) {
    if (e) e.preventDefault();
    const menuAjustes = document.querySelector("#seccion-menu-cuenta-ajustes");
    menuAjustes.classList.remove("flex-display");
    menuAjustes.classList.add("ocultar-display");

    // Reset state if necessary
    bloquear_span_cambio_contraseña = true; // Match renderer.js behavior
}

async function cerrar_sesion_bt(e) {
    e.preventDefault();
    await window.sesion_usuario.CERRAR_SESION();
    // Assuming UI handles redirection or state change
}

// --- Settings Change Logic ---

function cambiar_seccion_menu_cambiar_datos_cuenta(tipo) {
    ["correo", "contraseña", "apodo"].forEach(t => {
        const el = document.querySelector(`#seccion-cambiar-${t}-menu`);
        if (tipo === t) {
            el.classList.remove("ocultar-display");
            el.classList.add("flex-display");
        } else {
            el.classList.remove("flex-display");
            el.classList.add("ocultar-display");
        }
    });
}

function mostrarErrorForm(id, text) {
    const el = document.querySelector(id);
    el.classList.remove("ocultar-display");
    el.classList.add("flex-display");
    el.innerHTML = text;
}

// --- Password Change ---

async function funcion_cambiar_contraseña(e) {
    e.preventDefault();
    if (bloquear_span_cambio_contraseña) {
        window.pushNotificacion({ prioridad: 1, texto: "Debes esperar 24h desde la última vez para volver a cambiar la contraseña", tipo: "error" });
        return;
    }

    const result = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ tipo: "contraseña" });
    if (result.success) {
        const container = document.querySelector("#alineador-menu-cambiar-data-cuenta");
        container.classList.remove("ocultar-display");
        container.classList.add("flex-display");
        cambiar_seccion_menu_cambiar_datos_cuenta("contraseña");
        document.querySelector("#cambio-pass").focus();

        const form = document.querySelector("#form-cambio-contraseña");
        const submitHandler = async (ev) => {
            ev.preventDefault();
            const pass = document.querySelector("#cambio-pass").value;
            const confirm = document.querySelector("#cambio-pass-confirm").value;
            const errorTextId = "#text-error-form-causa-cambio-contraseña";

            if (pass !== confirm) {
                document.querySelector("#cambio-pass-confirm").classList.add("estrada-menu-registro-login-incorrecto");
                document.querySelector("#span-repetir-contraseña-cambio").classList.add("estrada-menu-registro-login-incorrecto");
                return;
            }

            document.querySelector("#cambio-pass-confirm").classList.remove("estrada-menu-registro-login-incorrecto");
            document.querySelector("#span-repetir-contraseña-cambio").classList.remove("estrada-menu-registro-login-incorrecto");

            if (pass.includes(" ")) return mostrarErrorForm(errorTextId, "*No puedes usar espacios*");
            if (pass.length > 30) return mostrarErrorForm(errorTextId, "*Longitud contraseña <=30*");

            const check = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: pass, tipo: "contraseña" });
            if (check?.success) {
                form.removeEventListener("submit", submitHandler);
                document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.replace("flex-display", "ocultar-display");
                document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.replace("ocultar-display", "flex-display");
                document.querySelector("#bt-code-introducir-datos-cuenta").focus();

                const setupVerification = () => {
                    const closeBtn = document.querySelector("#bt-cerrar-menu-cambio-data-cuenta-cd");
                    const closeHandler = (evVal) => {
                        evVal.preventDefault();
                        document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.replace("flex-display", "ocultar-display");
                        bloquear_span_cambio_contraseña = false;
                        closeBtn.removeEventListener("click", closeHandler);
                    };
                    closeBtn.addEventListener("click", closeHandler);

                    const verifyForm = document.querySelector("#form-validation-correo-ajustes-datos-cuenta");
                    verifyForm.addEventListener("submit", async (evVerify) => {
                        evVerify.preventDefault();
                        const code = document.querySelector("#bt-code-introducir-datos-cuenta").value;
                        const finalResult = await window.cuenta_usuario.CAMBIAR_DATOS_CUENTA(pass, code, "contraseña");

                        if (finalResult) {
                            window.pushNotificacion({ prioridad: 0, texto: "Contraseña cambiada", tipo: "success" });
                            bloquear_span_cambio_contraseña = true;
                            await window.paginas_app.CAMBIAR_PAGINA_SESION();
                        } else {
                            window.pushNotificacion({ prioridad: 0, texto: "Fallo: código incorrecto o error al cambiar", tipo: "error" });
                        }
                    }, { once: true });
                };
                setupVerification();
            } else {
                window.pushNotificacion({ prioridad: 0, texto: result.message || "Fallo: cambiar contraseña", tipo: "error" });
            }
        };
        form.addEventListener("submit", submitHandler, { once: true });
    } else {
        bloquear_span_cambio_contraseña = true;
        window.pushNotificacion({ prioridad: 1, texto: "Debes esperar a que termine el bloqueo", tipo: "error" });
    }
}

// --- Nickname Change ---

async function funcion_cambiar_apodo(e) {
    e.preventDefault();
    if (bloquear_span_cambio_apodo) {
        window.pushNotificacion({ prioridad: 1, texto: "Cambiaste de apodo hace poco. Debes esperar 24h desde la última vez.", tipo: "error" });
        return;
    }

    const result = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ tipo: "apodo" });
    if (result.success) {
        document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.replace("ocultar-display", "flex-display");
        cambiar_seccion_menu_cambiar_datos_cuenta("apodo");
        document.querySelector("#cambio-apodo").focus();

        const form = document.querySelector("#form-cambio-apodo");
        form.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            const apodo = document.querySelector("#cambio-apodo").value.trim();
            const errorId = "#text-error-form-causa-cambio-apodo";

            if (!(/^[a-zA-Z0-9_]/.test(apodo))) return mostrarErrorForm(errorId, "*No puedes usar espacios ni símbolos raros*");
            if (apodo.length > 30) return mostrarErrorForm(errorId, "*Longitud apodo <=30*");

            const check = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: apodo, tipo: "apodo" });
            if (check?.success) {
                const final = await window.cuenta_usuario.CAMBIAR_DATOS_CUENTA(apodo, null, "apodo");
                if (final) {
                    window.pushNotificacion({ prioridad: 0, texto: "Apodo cambiado correctamente", tipo: "success" });
                    bloquear_span_cambio_apodo = true;
                    document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.replace("flex-display", "ocultar-display");
                    if (typeof window.cambiar_menu_inicio_apodo === "function") window.cambiar_menu_inicio_apodo();
                } else {
                    window.pushNotificacion({ prioridad: 0, texto: "No se pudo cambiar el apodo", tipo: "error" });
                }
            }
        }, { once: true });
    } else {
        bloquear_span_cambio_apodo = true;
        window.pushNotificacion({ prioridad: 0, texto: "Cambiaste de apodo hace poco. Debes esperar 24h desde la última vez.", tipo: "error" });
    }
}

// --- Email Change ---

async function funcion_cambiar_correo(e) {
    e.preventDefault();
    if (bloquear_span_cambio_correo) {
        window.pushNotificacion({ prioridad: 1, texto: "Cambiaste de correo hace poco. Esperar 72h.", tipo: "error" });
        return;
    }

    const result = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ tipo: "correo" });
    if (result.success) {
        document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.replace("ocultar-display", "flex-display");
        cambiar_seccion_menu_cambiar_datos_cuenta("correo");
        document.querySelector("#cambio-correo").focus();

        const form = document.querySelector("#form-cambio-correo");
        form.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            const email = document.querySelector("#cambio-correo").value;
            const pass = document.querySelector("#confirmar-contraseña-correo").value;
            const errorId = "#text-error-form-causa-cambio-contraseña";

            if (email.length > 255) return mostrarErrorForm(errorId, "*Longitud correo <=255*");

            const passOk = await window.cuenta_usuario.COMPROBAR_CONTRASEÑA({ contraseña: pass });
            if (!passOk) return mostrarErrorForm(errorId, "*Contraseña incorrecta*");

            const check = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: email, tipo: "correo" });
            if (check?.success) {
                document.querySelector("#alineador-menu-cambiar-data-cuenta").classList.replace("flex-display", "ocultar-display");
                document.querySelector("#alineador-menu-cambiar-data-cuenta-validar-code").classList.replace("ocultar-display", "flex-display");
                document.querySelector("#bt-code-introducir-datos-cuenta").focus();

                const verifyForm = document.querySelector("#form-validation-correo-ajustes-datos-cuenta");
                verifyForm.addEventListener("submit", async (evVerify) => {
                    evVerify.preventDefault();
                    const code = document.querySelector("#bt-code-introducir-datos-cuenta").value;
                    const final = await window.cuenta_usuario.CAMBIAR_DATOS_CUENTA(email, code, "correo");
                    if (final) {
                        window.pushNotificacion({ prioridad: 1, texto: "Correo cambiado", tipo: "success" });
                        bloquear_span_cambio_correo = true;
                        await window.paginas_app.CAMBIAR_PAGINA_SESION();
                    } else {
                        window.pushNotificacion({ prioridad: 0, texto: "Error al cambiar el correo", tipo: "error" });
                    }
                }, { once: true });
            }
        }, { once: true });
    }
}

// --- Muted & Blocked Users ---

export async function ver_chats_silenciados(e) {
    if (e) e.stopPropagation();
    const container = document.querySelector("#principal-lista-usuarios-silenciados");
    const [contactos, silenciados] = await Promise.all([
        window.social_usuario.OBTENER_CONTACTOS_USUARIO(),
        window.social_usuario.OBTENER_USUARIOS_SILENCIADOS()
    ]);
    console.log(contactos,silenciados)
    //dividir cuales estan en contactos y cuales no
    const contactos_silenciados = contactos.filter(c => silenciados.includes(c.id));
    const no_contactos_silenciados = silenciados.filter(c => {
        const contacto = contactos.find(d => d.id === c);
        return !contacto || contacto.apodo === "";
    });
    console.log(no_contactos_silenciados)
    //buscar en db apodo de los que no estan en contactos
    let no_contactos_silenciados_apodos = [];
    let no_contactos_silenciados_con_apodo = [];
    if (no_contactos_silenciados.length > 0) {
        no_contactos_silenciados_apodos = await window.social_usuario.OBTENER_VARIOS_DATOS_USUARIOS_EXTERNOS(no_contactos_silenciados, "apodo");
        //todo: esto no devuelve bien el apodo o nombre de chat
        no_contactos_silenciados_con_apodo = no_contactos_silenciados.map(id => {
            const data = no_contactos_silenciados_apodos.find(a => a._id=== id);
            return {
                id,
                apodo: data?.apodo || data?.nombre || "Usuario desconocido"
            }
        });
    }

    const silenciados_final = [...contactos_silenciados, ...no_contactos_silenciados_con_apodo];
    console.log(silenciados_final)
    if (!silenciados_final || silenciados_final.length === 0) {
        container.innerHTML = "<span class='text-info-no-chats'>*SIN USUARIOS*</span>";
    } else {
        container.innerHTML = silenciados_final.map(u => `
            <div class="lista-item-ajustes">
                <span>${escapeHTML(u.apodo)}</span>
                <button class="bt-desilenciar" data-id="${u.id}">Desilenciar</button>
            </div>
        `).join("");

        container.querySelectorAll(".bt-desilenciar").forEach(btn => {
            btn.addEventListener("click", async () => {
                const ok = await window.social_usuario.ELIMINAR_USUARIO_SILENCIADOS(btn.dataset.id);
                if (ok) btn.closest("div").remove();
                else window.pushNotificacion({ prioridad: 3, texto: "Fallo al desilenciar usuario", tipo: "error" });
            });
        });
    }

    document.querySelector("#lista-usuarios-silenciados").classList.replace("ocultar-display", "flex-display");
    document.querySelector("#bt-cerrar-menu-lista-silenciados").onclick = () => {
        document.querySelector("#lista-usuarios-silenciados").classList.replace("flex-display", "ocultar-display");
    };
}

export async function ver_chats_bloqueados(e) {
    if (e) e.stopPropagation();
    const container = document.querySelector("#principal-lista-usuarios-bloqueados");
    container.innerHTML = "*CARGANDO...*";

    const users = await window.social_usuario.OBTENER_USUARIOS_BLOQUEADOS();
    if (!users || users.length === 0) {
        container.innerHTML = "*SIN USUARIOS*";
    } else {
        container.innerHTML = users.map(u => `
            <div class="lista-item-ajustes">
                <span>${escapeHTML(u.apodo)}</span>
                <button class="bt-desbloquear" data-id="${u.id || u._id}">Desbloquear</button>
            </div>
        `).join("");

        container.querySelectorAll(".bt-desbloquear").forEach(btn => {
            btn.addEventListener("click", async () => {
                const ok = await window.social_usuario.ELIMINAR_USUARIO_BLOQUEADO(btn.dataset.id);
                if (ok) btn.closest("div").remove();
                else window.pushNotificacion({ prioridad: 3, texto: "Fallo al desbloquear usuario", tipo: "error" });
            });
        });
    }

    document.querySelector("#lista-usuarios-bloqueados").classList.replace("ocultar-display", "flex-display");
    document.querySelector("#bt-cerrar-menu-lista-bloqueados").onclick = () => {
        document.querySelector("#lista-usuarios-bloqueados").classList.replace("flex-display", "ocultar-display");
    };
}

async function cargar_ajustes_cache() {
    const ajustes = await window.ajustes_app.OBTENER_AJUSTES_APP() || {}

    document.querySelector("#input-cache-chats-ram").value = ajustes.LIMITE_CHAT_CACHE_RAM || 1024
    document.querySelector("#input-cache-chats-disk").value = ajustes.LIMITE_CHAT_CACHE_DISK || 2048
    document.querySelector("#input-cache-usuarios-ram").value = ajustes.LIMITE_USER_CACHE_RAM || 512
    document.querySelector("#input-cache-usuarios-disk").value = ajustes.LIMITE_USER_CACHE_DISK || 1024
    document.querySelector("#check-forzar-disco").checked = ajustes.FORCE_DISK_CACHE || false
}

function setup_cache_listeners() {
    const inputs = [
        { id: "#input-cache-chats-ram", key: "LIMITE_CHAT_CACHE_RAM" },
        { id: "#input-cache-chats-disk", key: "LIMITE_CHAT_CACHE_DISK" },
        { id: "#input-cache-usuarios-ram", key: "LIMITE_USER_CACHE_RAM" },
        { id: "#input-cache-usuarios-disk", key: "LIMITE_USER_CACHE_DISK" }
    ]

    inputs.forEach(item => {
        document.querySelector(item.id).addEventListener("change", async (e) => {
            const val = parseInt(e.target.value)
            if (isNaN(val) || val < 64) return

            const ajustes = await window.ajustes_app.OBTENER_AJUSTES_APP() || {}
            ajustes[item.key] = val
            await window.ajustes_app.GUARDAR_AJUSTES_APP(ajustes)

            // Notificar al backend para actualizar config instantáneamente
            if (item.key.includes("CHAT")) {
                await window.cache_persistente.setConfigCacheChats({ [item.key]: val })
            } else {
                await window.cache_persistente.setConfigCacheUsuarios({ [item.key]: val })
            }
        })
    })

    document.querySelector("#check-forzar-disco").addEventListener("change", async (e) => {
        const val = e.target.checked
        const ajustes = await window.ajustes_app.OBTENER_AJUSTES_APP() || {}
        ajustes.FORCE_DISK_CACHE = val
        await window.ajustes_app.GUARDAR_AJUSTES_APP(ajustes)

        await window.cache_persistente.setConfigCacheChats({ FORCE_DISK_CACHE: val })
        await window.cache_persistente.setConfigCacheUsuarios({ FORCE_DISK_CACHE: val })
    })

    document.querySelector("#bt-limpiar-cache-chats").addEventListener("click", async () => {
        const ok = await window.cache_persistente.clearCacheChats()
        if (ok) window.pushNotificacion({ prioridad: 2, texto: "Caché de chats limpiada", tipo: "success" })
    })

    document.querySelector("#bt-limpiar-cache-usuarios").addEventListener("click", async () => {
        const ok = await window.cache_persistente.clearCacheUsuarios()
        if (ok) window.pushNotificacion({ prioridad: 2, texto: "Caché de usuarios limpiada", tipo: "success" })
    })
}
