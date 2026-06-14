export let bloquear_span_cambio_contraseña = false;
export let bloquear_span_cambio_apodo = false;
export let bloquear_span_cambio_correo = false;
export let HILOS_DESACTIVADOS = false;
import { escapeHTML } from './seguridad_ui.js';
import { 
    APODO_USUARIO, 
    establecer_apodo_usuario, 
    CORREO_USUARIO, 
    establecer_correo_usuario,
    obtener_apodo_usuario,
    borrar_cache_apodo_usuario,
    DOM_CACHE 
} from '../caches_datos.js';


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
    const menuAjustes = DOM_CACHE.menu_ajustes;
    menuAjustes?.classList.remove("ocultar-display");
    menuAjustes?.classList.add("flex-display");

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

    document.getElementById("bt-cerrar-menu-ajustes").addEventListener("click", cerrar_ajustes_pagina);
    document.getElementById("bt-cerrar-sesion").addEventListener("click", cerrar_sesion_bt);
    document.getElementById("bt-cambiar-contraseña").addEventListener("click", funcion_cambiar_contraseña);
    document.getElementById("bt-cambiar-apodo").addEventListener("click", funcion_cambiar_apodo);
    document.getElementById("bt-cambiar-correo").addEventListener("click", funcion_cambiar_correo);
    document.getElementById("bt-ver-chats-silenciados").addEventListener("click", ver_chats_silenciados);
    document.getElementById("bt-ver-chats-bloqueados").addEventListener("click", ver_chats_bloqueados);
    document.getElementById("bt-descargar-clave-privada").addEventListener("click", descargar_clave_privada);
    document.getElementById("bt-cargar-clave-privada").addEventListener("click", cargar_clave_privada);
    document.getElementById("bt-gestionar-claves").addEventListener("click", gestionar_claves);
    document.getElementById("bt-cerrar-modal-pass-claves").addEventListener("click", () => {
        document.getElementById("modal-verificar-pass-claves").style.display = "none";
        document.getElementById("input-pass-verificar-claves").value = "";
        document.getElementById("error-pass-verificar-claves").textContent = "";
    });
    document.getElementById("bt-confirmar-pass-claves").addEventListener("click", confirmar_pass_claves);
    document.getElementById("input-pass-verificar-claves").addEventListener("keydown", (e) => {
        if (e.key === "Enter") confirmar_pass_claves();
    });
    document.getElementById("bt-cerrar-modal-claves").addEventListener("click", () => {
        document.getElementById("modal-gestionar-claves").style.display = "none";
    });
    document.getElementById("bt-añadir-clave-soporte").addEventListener("click", añadir_clave_soporte);
    document.getElementById("bt-cerrar-menu-cambio-data").addEventListener("click", (e) => {
        e.preventDefault();
        const menuCambio = DOM_CACHE.menu_cambiar_datos_cuenta;
        menuCambio?.classList.remove("flex-display");
        menuCambio?.classList.add("ocultar-display");
        document.getElementById("cambio-pass").value = "";
        document.getElementById("cambio-pass-confirm").value = "";
    });

    // INICIAR CACHE SETTINGS
    await cargar_ajustes_cache();
    setup_cache_listeners();

    // Marcar inicializado solo si todo fue bien
    ajustesEventosInicializados = true;
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
        const el = document.getElementById(`cuerpo-ajustes-${idSuffix}`);
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
    const [fecha_creacion, fecha_bloqueo_apodo, fecha_bloqueo_correo, fecha_bloqueo_contraseña] = await Promise.all([
        window.cuenta_usuario.OBTENER_FECHA_CREACION_CUENTA(),
        window.cuenta_usuario.OBTENER_FECHA_BLOQUEO_APODO(),
        window.cuenta_usuario.OBTENER_FECHA_BLOQUEO_CORREO(),
        window.cuenta_usuario.OBTENER_FECHA_BLOQUEO_CONTRASEÑA()
    ]);
    const apodo = await obtener_apodo_usuario();
    const correo = CORREO_USUARIO;

    document.getElementById("text-cuenta-apodo").innerHTML = `Apodo: <font color="#E53612">${escapeHTML(apodo)}</font>`;
    document.getElementById("text-cuenta-correo").innerHTML = `Correo electrónico: <font color="#E53612">${escapeHTML(correo)}</font>`;
    document.getElementById("text-cuenta-creada-fecha").innerHTML = `*Cuenta creada el ${escapeHTML(fecha_creacion)}`;

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
    const menuAjustes = DOM_CACHE.menu_ajustes;
    menuAjustes?.classList.remove("flex-display");
    menuAjustes?.classList.add("ocultar-display");

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
        const el = document.getElementById(`seccion-cambiar-${t}-menu`);
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
        const container = DOM_CACHE.menu_cambiar_datos_cuenta;
        container?.classList.remove("ocultar-display");
        container?.classList.add("flex-display");
        cambiar_seccion_menu_cambiar_datos_cuenta("contraseña");
        document.getElementById("cambio-pass").focus();

        const form = document.getElementById("form-cambio-contraseña");
        const submitHandler = async (ev) => {
            ev.preventDefault();
            const pass = document.getElementById("cambio-pass").value;
            const confirm = document.getElementById("cambio-pass-confirm").value;
            const errorTextId = "#text-error-form-causa-cambio-contraseña";

            if (pass !== confirm) {
                document.getElementById("cambio-pass-confirm").classList.add("estrada-menu-registro-login-incorrecto");
                document.getElementById("span-repetir-contraseña-cambio").classList.add("estrada-menu-registro-login-incorrecto");
                return;
            }

            document.getElementById("cambio-pass-confirm").classList.remove("estrada-menu-registro-login-incorrecto");
            document.getElementById("span-repetir-contraseña-cambio").classList.remove("estrada-menu-registro-login-incorrecto");

            if (pass.includes(" ")) return mostrarErrorForm(errorTextId, "*No puedes usar espacios*");
            if (pass.length > 30) return mostrarErrorForm(errorTextId, "*Longitud contraseña <=30*");

            const check = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: pass, tipo: "contraseña" });
            if (check?.success) {
                form.removeEventListener("submit", submitHandler);
                DOM_CACHE.menu_cambiar_datos_cuenta?.classList.replace("flex-display", "ocultar-display");
                document.getElementById("alineador-menu-cambiar-data-cuenta-validar-code").classList.replace("ocultar-display", "flex-display");
                document.getElementById("bt-code-introducir-datos-cuenta").focus();

                const setupVerification = () => {
                    const closeBtn = document.getElementById("bt-cerrar-menu-cambio-data-cuenta-cd");
                    const closeHandler = (evVal) => {
                        evVal.preventDefault();
                        document.getElementById("alineador-menu-cambiar-data-cuenta-validar-code").classList.replace("flex-display", "ocultar-display");
                        bloquear_span_cambio_contraseña = false;
                        closeBtn.removeEventListener("click", closeHandler);
                    };
                    closeBtn.addEventListener("click", closeHandler);

                    const verifyForm = document.getElementById("form-validation-correo-ajustes-datos-cuenta");
                    verifyForm.addEventListener("submit", async (evVerify) => {
                        evVerify.preventDefault();
                        const code = document.getElementById("bt-code-introducir-datos-cuenta").value;
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
        DOM_CACHE.menu_cambiar_datos_cuenta?.classList.replace("ocultar-display", "flex-display");
        cambiar_seccion_menu_cambiar_datos_cuenta("apodo");
        document.getElementById("cambio-apodo").focus();

        const form = document.getElementById("form-cambio-apodo");
        form.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            const apodo = document.getElementById("cambio-apodo").value.trim();
            const errorId = "#text-error-form-causa-cambio-apodo";

            if (!(/^[a-zA-Z0-9_]/.test(apodo))) return mostrarErrorForm(errorId, "*No puedes usar espacios ni símbolos raros*");
            if (apodo.length > 30) return mostrarErrorForm(errorId, "*Longitud apodo <=30*");

            const check = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: apodo, tipo: "apodo" });
            if (check?.success) {
                const final = await window.cuenta_usuario.CAMBIAR_DATOS_CUENTA(apodo, null, "apodo");
                if (final) {
                    window.pushNotificacion({ prioridad: 0, texto: "Apodo cambiado correctamente", tipo: "success" });
                    bloquear_span_cambio_apodo = true;
                    
                    // Borramos la caché para que se fuerce la recarga si se solicita de nuevo
                    borrar_cache_apodo_usuario();
                    
                    DOM_CACHE.menu_cambiar_datos_cuenta?.classList.replace("flex-display", "ocultar-display");
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
        DOM_CACHE.menu_cambiar_datos_cuenta?.classList.replace("ocultar-display", "flex-display");
        cambiar_seccion_menu_cambiar_datos_cuenta("correo");
        document.getElementById("cambio-correo").focus();

        const form = document.getElementById("form-cambio-correo");
        form.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            const email = document.getElementById("cambio-correo").value;
            const pass = document.getElementById("confirmar-contraseña-correo").value;
            const errorId = "#text-error-form-causa-cambio-contraseña";

            if (email.length > 255) return mostrarErrorForm(errorId, "*Longitud correo <=255*");

            const passOk = await window.cuenta_usuario.COMPROBAR_CONTRASEÑA({ contraseña: pass });
            if (!passOk) return mostrarErrorForm(errorId, "*Contraseña incorrecta*");

            const check = await window.cuenta_usuario.PERMITIR_CAMBIO_DATOS_CUENTA({ data: email, tipo: "correo" });
            if (check?.success) {
                DOM_CACHE.menu_cambiar_datos_cuenta?.classList.replace("flex-display", "ocultar-display");
                document.getElementById("alineador-menu-cambiar-data-cuenta-validar-code").classList.replace("ocultar-display", "flex-display");
                document.getElementById("bt-code-introducir-datos-cuenta").focus();

                const verifyForm = document.getElementById("form-validation-correo-ajustes-datos-cuenta");
                verifyForm.addEventListener("submit", async (evVerify) => {
                    evVerify.preventDefault();
                    const code = document.getElementById("bt-code-introducir-datos-cuenta").value;
                    const final = await window.cuenta_usuario.CAMBIAR_DATOS_CUENTA(email, code, "correo");
                    if (final) {
                        window.pushNotificacion({ prioridad: 1, texto: "Correo cambiado", tipo: "success" });
                        bloquear_span_cambio_correo = true;
                        establecer_correo_usuario(email);
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
    const container = document.getElementById("principal-lista-usuarios-silenciados");
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

    DOM_CACHE.lista_silenciados?.classList.replace("ocultar-display", "flex-display");
    document.getElementById("bt-cerrar-menu-lista-silenciados").onclick = () => {
        DOM_CACHE.lista_silenciados?.classList.replace("flex-display", "ocultar-display");
    };
}

export async function ver_chats_bloqueados(e) {
    if (e) e.stopPropagation();
    const container = document.getElementById("principal-lista-usuarios-bloqueados");
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

    DOM_CACHE.lista_bloqueados?.classList.replace("ocultar-display", "flex-display");
    document.getElementById("bt-cerrar-menu-lista-bloqueados").onclick = () => {
        DOM_CACHE.lista_bloqueados?.classList.replace("flex-display", "ocultar-display");
    };
}

async function descargar_clave_privada(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById("bt-descargar-clave-privada");
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<img src="../recursos/descargar.png" alt="" draggable="false" loading="lazy" decoding="async"> Descargando...`;
    try {
        const resultado = await window.ajustes_app.EXPORTAR_CLAVE_PRIVADA();
        if (resultado?.ok) {
            window.pushNotificacion({ prioridad: 1, texto: `Clave privada guardada en Descargas`, tipo: "exito" });
        } else {
            window.pushNotificacion({ prioridad: 3, texto: resultado?.error || "Error al exportar la clave privada", tipo: "error" });
        }
    } catch(err) {
        window.pushNotificacion({ prioridad: 3, texto: err?.message || "Error inesperado al exportar la clave privada", tipo: "error" });
    } finally {
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
    }
}

async function cargar_clave_privada(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById("bt-cargar-clave-privada");
    btn.disabled = true;
    try {
        const resultado = await window.ajustes_app.IMPORTAR_CLAVE_PRIVADA_ARCHIVO();
        if (resultado?.ok) {
            window.pushNotificacion({ prioridad: 1, texto: `Clave de soporte añadida (id: ${resultado.id})`, tipo: "exito" });
        } else if (resultado?.error !== 'Cancelado') {
            window.pushNotificacion({ prioridad: 3, texto: resultado?.error || "Error al importar clave", tipo: "error" });
        }
    } catch(err) {
        window.pushNotificacion({ prioridad: 3, texto: err?.message || "Error inesperado al importar la clave", tipo: "error" });
    } finally {
        btn.disabled = false;
    }
}

function gestionar_claves(e) {
    if (e) e.preventDefault();
    document.getElementById("error-pass-verificar-claves").textContent = "";
    document.getElementById("input-pass-verificar-claves").value = "";
    document.getElementById("modal-verificar-pass-claves").style.display = "flex";
    setTimeout(() => document.getElementById("input-pass-verificar-claves")?.focus(), 80);
}

async function confirmar_pass_claves() {
    const input = document.getElementById("input-pass-verificar-claves");
    const errorEl = document.getElementById("error-pass-verificar-claves");
    const btn = document.getElementById("bt-confirmar-pass-claves");
    const contraseña = input.value;
    if (!contraseña) { errorEl.textContent = "Introduce tu contraseña"; return; }
    btn.disabled = true;
    errorEl.textContent = "";
    try {
        const res = await window.ajustes_app.VERIFICAR_CONTRASENA_ACTUAL(contraseña);
        if (!res?.ok) {
            errorEl.textContent = res?.error || "Contraseña incorrecta";
            return;
        }
        document.getElementById("modal-verificar-pass-claves").style.display = "none";
        input.value = "";
        await mostrar_modal_claves();
    } catch(err) {
        errorEl.textContent = err?.message || "Error al verificar la contraseña";
    } finally {
        btn.disabled = false;
    }
}

async function mostrar_modal_claves() {
    const container = document.getElementById("lista-claves-identidad");
    container.innerHTML = '<span style="color:#64748b;font-size:13px">Cargando...</span>';
    document.getElementById("modal-gestionar-claves").style.display = "flex";
    try {
        const claves = await window.ajustes_app.LISTAR_CLAVES_IDENTIDAD();
        _renderizar_lista_claves(claves);
    } catch {
        container.innerHTML = '<span style="color:#f87171;font-size:13px">Error cargando claves</span>';
    }
}

function _renderizar_lista_claves(claves) {
    const container = document.getElementById("lista-claves-identidad");
    if (!claves || claves.length === 0) {
        container.innerHTML = '<span style="color:#64748b;font-size:13px">No hay claves guardadas.</span>';
        return;
    }
    container.innerHTML = '';
    for (const c of claves) {
        const esPrincipal = c.tipo === 'primary';
        const fecha = c.fecha ? new Date(c.fecha).toLocaleDateString('es-ES') : '';
        const item = document.createElement('div');
        item.className = 'clave-item' + (esPrincipal ? ' es-principal' : '');
        item.innerHTML = `
            <span class="clave-item-badge">${esPrincipal ? 'Principal' : 'Soporte'}</span>
            <div class="clave-item-info">
                <span class="clave-item-id">${c.id}</span>
                <span class="clave-item-label">${c.label || (esPrincipal ? 'Clave principal' : 'Clave de soporte')}${fecha ? ' · ' + fecha : ''}</span>
            </div>
            <div class="clave-item-acciones">
                ${!esPrincipal ? `<button class="bt-hacer-principal" data-id="${c.id}">Hacer principal</button>` : ''}
                ${!esPrincipal ? `<button class="bt-eliminar-soporte" data-id="${c.id}">Eliminar</button>` : ''}
            </div>`;
        container.appendChild(item);
    }
    container.querySelectorAll('.bt-hacer-principal').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const res = await window.ajustes_app.CAMBIAR_CLAVE_PRINCIPAL(btn.dataset.id).catch(() => ({ ok: false, error: 'Error' }));
            if (res?.ok) {
                window.pushNotificacion({ prioridad: 1, texto: 'Clave principal actualizada', tipo: "exito" });
                const claves = await window.ajustes_app.LISTAR_CLAVES_IDENTIDAD().catch(() => []);
                _renderizar_lista_claves(claves);
            } else {
                window.pushNotificacion({ prioridad: 3, texto: res?.error || 'Error al cambiar clave', tipo: "error" });
                btn.disabled = false;
            }
        });
    });
    container.querySelectorAll('.bt-eliminar-soporte').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            const res = await window.ajustes_app.ELIMINAR_CLAVE_SOPORTE(btn.dataset.id).catch(() => ({ ok: false, error: 'Error' }));
            if (res?.ok) {
                btn.closest('.clave-item').remove();
                window.pushNotificacion({ prioridad: 1, texto: 'Clave de soporte eliminada', tipo: "exito" });
            } else {
                window.pushNotificacion({ prioridad: 3, texto: res?.error || 'Error al eliminar', tipo: "error" });
                btn.disabled = false;
            }
        });
    });
}

async function añadir_clave_soporte() {
    const btn = document.getElementById("bt-añadir-clave-soporte");
    btn.disabled = true;
    try {
        const resultado = await window.ajustes_app.IMPORTAR_CLAVE_PRIVADA_ARCHIVO();
        if (resultado?.ok) {
            window.pushNotificacion({ prioridad: 1, texto: `Clave de soporte añadida`, tipo: "exito" });
            const claves = await window.ajustes_app.LISTAR_CLAVES_IDENTIDAD().catch(() => []);
            _renderizar_lista_claves(claves);
        } else if (resultado?.error !== 'Cancelado') {
            window.pushNotificacion({ prioridad: 3, texto: resultado?.error || "Error al importar clave", tipo: "error" });
        }
    } catch {
        window.pushNotificacion({ prioridad: 3, texto: "Error inesperado", tipo: "error" });
    } finally {
        btn.disabled = false;
    }
}

async function cargar_ajustes_cache() {
    const ajustes = await window.ajustes_app.OBTENER_AJUSTES_APP() || {}

    document.getElementById("input-cache-chats-ram").value = ajustes.LIMITE_CHAT_CACHE_RAM || 1024
    document.getElementById("input-cache-chats-disk").value = ajustes.LIMITE_CHAT_CACHE_DISK || 2048
    document.getElementById("input-cache-usuarios-ram").value = ajustes.LIMITE_USER_CACHE_RAM || 512
    document.getElementById("input-cache-usuarios-disk").value = ajustes.LIMITE_USER_CACHE_DISK || 1024
    document.getElementById("check-forzar-disco").checked = ajustes.FORCE_DISK_CACHE || false
    
    const checkHilos = document.getElementById("check-desactivar-hilos");
    if (checkHilos) {
        checkHilos.checked = ajustes.DESACTIVAR_HILOS_VISUALES || false;
        aplicar_ajuste_hilos(checkHilos.checked);
    }
    
    const checkFondo = document.getElementById("check-desactivar-segundo-plano");
    if (checkFondo) {
        checkFondo.checked = ajustes.DESACTIVAR_SEGUNDO_PLANO || false;
    }

    // Notificaciones OS
    const notiChecks = [
        { id: "check-noti-os-msg-individual",    key: "NOTI_OS_MENSAJE_INDIVIDUAL" },
        { id: "check-noti-os-msg-grupal",         key: "NOTI_OS_MENSAJE_GRUPAL" },
        { id: "check-noti-os-descarga-individual",key: "NOTI_OS_DESCARGA_INDIVIDUAL" },
        { id: "check-noti-os-descarga-grupal",    key: "NOTI_OS_DESCARGA_GRUPAL" },
    ];
    for (const { id, key } of notiChecks) {
        const el = document.getElementById(id);
        if (el) el.checked = ajustes[key] !== false; // true por defecto
    }
}

export function aplicar_ajuste_hilos(desactivar) {
    HILOS_DESACTIVADOS = desactivar;
    if (desactivar) {
        document.body.classList.add("sin-hilos-chat");
    } else {
        document.body.classList.remove("sin-hilos-chat");
    }
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

    document.getElementById("check-forzar-disco").addEventListener("change", async (e) => {
        const val = e.target.checked
        const ajustes = await window.ajustes_app.OBTENER_AJUSTES_APP() || {}
        ajustes.FORCE_DISK_CACHE = val
        await window.ajustes_app.GUARDAR_AJUSTES_APP(ajustes)

        await window.cache_persistente.setConfigCacheChats({ FORCE_DISK_CACHE: val })
        await window.cache_persistente.setConfigCacheUsuarios({ FORCE_DISK_CACHE: val })
    })

    document.getElementById("check-desactivar-hilos").addEventListener("change", async (e) => {
        const val = e.target.checked
        const ajustes = await window.ajustes_app.OBTENER_AJUSTES_APP() || {}
        ajustes.DESACTIVAR_HILOS_VISUALES = val
        await window.ajustes_app.GUARDAR_AJUSTES_APP(ajustes)
        
        aplicar_ajuste_hilos(val);
    })

    document.getElementById("check-desactivar-segundo-plano")?.addEventListener("change", async (e) => {
        const val = e.target.checked;
        const ajustes = await window.ajustes_app.OBTENER_AJUSTES_APP() || {};
        ajustes.DESACTIVAR_SEGUNDO_PLANO = val;
        await window.ajustes_app.GUARDAR_AJUSTES_APP(ajustes);
    });

    document.getElementById("bt-limpiar-cache-chats").addEventListener("click", async () => {
        const ok = await window.cache_persistente.clearCacheChats()
        if (ok) window.pushNotificacion({ prioridad: 2, texto: "Caché de chats limpiada", tipo: "success" })
    })

    document.getElementById("bt-limpiar-cache-usuarios").addEventListener("click", async () => {
        const ok = await window.cache_persistente.clearCacheUsuarios()
        if (ok) window.pushNotificacion({ prioridad: 2, texto: "Caché de usuarios limpiada", tipo: "success" })
    })

    // Listeners notificaciones OS
    const notiChecks = [
        { id: "check-noti-os-msg-individual",     key: "NOTI_OS_MENSAJE_INDIVIDUAL" },
        { id: "check-noti-os-msg-grupal",          key: "NOTI_OS_MENSAJE_GRUPAL" },
        { id: "check-noti-os-descarga-individual", key: "NOTI_OS_DESCARGA_INDIVIDUAL" },
        { id: "check-noti-os-descarga-grupal",     key: "NOTI_OS_DESCARGA_GRUPAL" },
    ];
    for (const { id, key } of notiChecks) {
        document.getElementById(id)?.addEventListener("change", async (e) => {
            const ajustes = await window.ajustes_app.OBTENER_AJUSTES_APP() || {};
            ajustes[key] = e.target.checked;
            await window.ajustes_app.GUARDAR_AJUSTES_APP(ajustes);
        });
    }
}
