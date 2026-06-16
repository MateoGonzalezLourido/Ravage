# Sistema de Notificaciones

Ravage tiene tres canales de notificación independientes: notificaciones del SO (sistema operativo), notificaciones in-app y correos electrónicos. Cada canal tiene sus propios ajustes configurables por el usuario desde el panel de Ajustes → Notificaciones.

---

## 1. Notificaciones del sistema operativo (OS)

### Infraestructura

| Archivo | Rol |
|---|---|
| `backend/services/notificaciones_os.js` | Lógica de envío y decisión |
| `backend/ipc/chat_ipc.js` | Dispara la notificación de descarga |
| `backend/services/buzonAPI.js` | Dispara las notificaciones de eventos de buzón |
| `electron/main.js` | Referencia al `mainWindow` que se pasa a las funciones |

Internamente se usa `Electron.Notification` (envuelto en `ElectronNotification` de `backend/utils/libs.js`). Si el SO no soporta notificaciones nativas (`Notification.isSupported() === false`), el sistema las omite silenciosamente.

### Reglas globales (siempre aplicadas antes de cualquier ajuste)

1. **Ventana con foco** — si la `mainWindow` está visible y tiene foco, no se envía ninguna notificación OS. El usuario ya está viendo la app.
2. **Chat silenciado** — si la entrada del buzón tiene `silenciado: true` (el chat o el emisor están silenciados), no se envía notificación OS.

### Tipos de buzón y su notificación OS

Las notificaciones OS de eventos de chat se generan en `procesarNotificacionOSEntrada`, llamada desde `buzonAPI.js` al recibir cada entrada del buzón.

| Tipo buzón | Evento | Ajuste que lo controla | Condición extra |
|---|---|---|---|
| `0` | Nuevo mensaje (chat de contacto) | `NOTI_OS_MENSAJE_INDIVIDUAL` | — |
| `0` | Nuevo mensaje (chat grupal) | `NOTI_OS_MENSAJE_GRUPAL` | `data.esGrupal === true` |
| `0` | Mención (`@tú`) | **Siempre** (excepción irrevocable) | `data.menciones` incluye tu ID |
| `1` / `3` | Te han añadido a un grupo | `NOTI_OS_GRUPO_PERSONAL` | `data.añadido` o `data.usuarios` incluye tu ID |
| `4` | Has sido expulsado de un grupo | `NOTI_OS_GRUPO_PERSONAL` | `data.expulsado` es tu ID |
| `8` | Mensaje fijado en el grupo | `NOTI_OS_MENSAJE_FIJADO` | — |

> Tipos 1, 3 y 4 solo disparan OS si el evento te afecta **directamente**. Que otra persona sea añadida o expulsada no genera notificación OS para el resto de miembros.

> Tipo 2 (crear grupo) no genera notificación OS, es un evento menor.

Las notificaciones de descarga se generan en `procesarNotificacionOSDescarga`, llamada desde el handler IPC `descargar-archivo` en `chat_ipc.js`:

| Evento | Ajuste | Condición extra |
|---|---|---|
| Descarga completada (chat de contacto) | `NOTI_OS_DESCARGA_INDIVIDUAL` | `esGrupal === false` |
| Descarga completada (chat grupal) | `NOTI_OS_DESCARGA_GRUPAL` | `esGrupal === true` |

### Excepción de menciones

Si `NOTI_OS_MENSAJE_INDIVIDUAL` o `NOTI_OS_MENSAJE_GRUPAL` están desactivados, las menciones directas (`@tú`) siguen disparando una notificación OS con el texto "Te han mencionado". Esta excepción **no tiene toggle** propio y no puede desactivarse, igual que los correos de verificación.

Los IDs de las menciones se extraen del texto del mensaje en `ENVIAR_MENSAJE` (patrón `@{24hexId}`) antes de cifrarlo y se incluyen en el campo `data.menciones` de la entrada de buzón.

### Ajustes disponibles (`ajustes_app.json`)

| Clave | Descripción | Defecto |
|---|---|---|
| `NOTI_OS_MENSAJE_INDIVIDUAL` | Mensajes nuevos en chat de contacto | `true` |
| `NOTI_OS_MENSAJE_GRUPAL` | Mensajes nuevos en chat grupal | `true` |
| `NOTI_OS_DESCARGA_INDIVIDUAL` | Descarga completada en chat de contacto | `true` |
| `NOTI_OS_DESCARGA_GRUPAL` | Descarga completada en chat grupal | `true` |
| `NOTI_OS_MENSAJE_FIJADO` | Mensaje fijado en un grupo | `true` |
| `NOTI_OS_GRUPO_PERSONAL` | Te añaden o expulsan de un grupo | `true` |

---

## 2. Notificaciones in-app

Son los banners visuales que aparecen dentro de la propia interfaz de Ravage. Se implementan en `frontend/notificaciones/notificaciones.js` con una cola secuencial (una a la vez).

### Canales de entrada

**A. `pushNotificacion` (frontend directo)**
Cualquier parte del frontend puede llamar a `window.pushNotificacion({ prioridad, texto, tipo })`:
- Se usa para errores de UI, confirmaciones de acciones locales y resultados de operaciones.
- Tipos visuales: `"info"`, `"success"`, `"warning"`, `"error"`.

**B. `notificar-render` (IPC desde backend)**
El backend envía `mainWindow.webContents.send("notificar-render", { texto, tipo })` para notificar al renderer de un resultado de operación backend. Ejemplo: "Descarga completa: archivo.pdf" al finalizar `DESCARGAR_ARCHIVO`.

**C. Buzón de eventos (`nueva-notificacion`)**
Cuando llega una entrada de buzón que afecta al chat lateral (nuevo mensaje, alguien añadido, expulsión, etc.), `buzon_eventos.js` genera internamente un `pushNotificacion` con el texto correspondiente, pero solo si el chat no está silenciado y no está abierto en pantalla.

### No tiene ajustes de usuario
Las notificaciones in-app no son configurables. Siempre se muestran independientemente de los ajustes OS o de correo.

---

## 3. Notificaciones por correo electrónico

Se envían con Brevo (ex Sendinblue) desde `backend/services/MENSAJERIA/Servicio_mensajeria_correo.js`. Los templates HTML están en `Estructuras_correos.js`.

### Regla de envío

Antes de llamar a `enviarEmail`, cada función comprueba el ajuste correspondiente con `correoPermitido(clave)`:

```js
async function correoPermitido(clave) {
    const val = await getAjustesAppFile(clave).catch(() => true);
    return val !== false;
}
```

Si el ajuste es `false`, la función retorna sin enviar. Si el archivo de ajustes falla al leerse, se considera `true` (falla abierta).

### Tabla de correos configurables

| Clave ajuste | Evento | Archivo de origen | Siempre enviado |
|---|---|---|---|
| `CORREO_INICIO_SESION` | Nuevo inicio de sesión | `sesionUsuario.js` | No |
| `CORREO_CAMBIO_CONTRASEÑA` | Cambio de contraseña | `Usuario.js` | No |
| `CORREO_CAMBIO_CORREO` | Cambio de correo | `Usuario.js` | No |
| `CORREO_CAMBIO_APODO` | Cambio de apodo | `Usuario.js` | No |
| `CORREO_DISPOSITIVO_CONFIANZA` | Dispositivo de confianza añadido o revocado | `sesionUsuario.js` | No |
| `CORREO_SESION_CERRADA` | Sesión cerrada remotamente | `sesionUsuario.js` | No |
| `CORREO_DISPOSITIVO_BLOQUEADO` | Dispositivo bloqueado o desbloqueado | `sesionUsuario.js` | No |
| *(sin clave)* | Código de verificación (registro, 2FA, cambio de datos) | `sesionUsuario.js`, `Usuario.js` | **Sí, siempre** |

> Los correos de código de verificación nunca tienen toggle. Son de seguridad crítica y no se puede deshabilitar su envío.

### Patrón fire-and-forget

Todos los envíos de correo se hacen en un bloque `async` inmediato sin `await` desde el flujo principal, para no bloquear la respuesta al usuario:

```js
;(async () => {
    if (!await correoPermitido('CORREO_INICIO_SESION')) return;
    const { asunto, htmlContenido } = ConfirmacionInicioSesion({ ... });
    enviarEmail({ correoDestino: correo, asunto, htmlContenido });
})();
```

Si `enviarEmail` falla (error de red, API de Brevo caída), el error se loguea pero no afecta al flujo de la app.

---

## 4. Tipos de buzón — tabla completa

El buzón (`BuzonUsuarios` en MongoDB) transporta eventos entre el servidor y los clientes conectados. Cada entrada tiene `{ tipo: number, data: object }` (el `data` se cifra con AES-256-GCM antes de almacenarse).

| Tipo | Nombre | Receptores | Frontend (`buzon_eventos.js`) | OS |
|---|---|---|---|---|
| `0` | Mensaje de chat | Todos los miembros excepto el emisor | Renderiza el mensaje en el chat y actualiza la lista lateral | Sí (configurable + excepción menciones) |
| `1` | Usuario añadido a grupo existente | Todos los miembros excepto el admin que añadió | In-app: "Te han añadido / X ha sido añadido" | Sí, solo si `data.añadido` eres tú |
| `2` | Grupo creado | Todos los miembros excepto el creador | In-app: "X ha creado un nuevo chat" | No |
| `3` | Usuario añadido (variante) | — | Manejado como tipo 1 | Sí, solo si el ID está en `data.usuarios` |
| `4` | Usuario expulsado | Todos los miembros en el momento de la expulsión | In-app: "Has sido expulsado / X ha sido expulsado" | Sí, solo si `data.expulsado` eres tú |
| `5` | Actualización silenciosa de chat | Miembros relevantes | Recarga la info del chat sin notificación | No |
| `6` | Solicitud de añadir usuario | Admin del grupo destino | Renderiza la solicitud en el chat | No |
| `7` | Respuesta a solicitud de añadir | Solicitante original | Informa del resultado de la solicitud | No |
| `8` | Mensaje fijado | Todos los miembros excepto el admin que fijó | In-app: "Mensaje fijado", actualiza el banner | Sí (configurable) |

---

## 5. Flujo completo de una notificación de mensaje nuevo

```
[Emisor envía mensaje]
        │
        ▼
ENVIAR_MENSAJE (MessageRepository.js)
  ├─ Extrae menciones del texto (@{id}) → campo data.menciones
  └─ Añadir_Entrada_Buzon_Usuario({ tipo: 0, data: { chat, id_mensaje, emisor, menciones? } })
        │
        ▼ (MongoDB Change Stream)
buzonAPI.js — iniciarBuzon()
  ├─ Descifra data de la entrada
  ├─ filtrar_entradas_ipc() → descarta si chat/usuario bloqueado, marca silenciado si silenciado
  ├─ mainWindow.webContents.send("nueva-notificacion", doc)  → frontend
  └─ procesarNotificacionOSEntrada()  → comprueba foco, ajustes, menciones → OS
        │
        ▼ (frontend)
buzon_eventos.js — procesar_entradas_buzon()
  ├─ Cambio_buzonApi_mensaje()
  │   ├─ Si chat abierto: renderiza el mensaje nuevo en pantalla
  │   ├─ Si chat en lista lateral: actualiza preview y badge
  │   └─ Si no silenciado y no abierto: pushNotificacion("Nuevo mensaje de X")
  └─ (otros tipos: hacer_cambios_buzon)
```

---

## 6. Sistema de limpieza del buzón

### Límite de entradas en memoria

`MAX_ENTRADAS = 200` en `backend/models/Buzon.js`. Se aplica con `$push` + `$slice: -MAX_ENTRADAS` directamente en la operación `bulkWrite` de MongoDB. Esto garantiza que, aunque lleguen muchos eventos mientras el usuario está desconectado, el documento del buzón nunca supera ese tamaño.

> El modelo también tiene un `pre('save')` que hace el mismo recorte. Es **código muerto**: `bulkWrite` y `findByIdAndUpdate` no disparan hooks de Mongoose, así que el límite siempre lo aplica el `$slice` del repositorio, nunca el hook.

### Deduplicación en el Change Stream (`sentIds`)

`buzonAPI.js` mantiene un `Set<string>` llamado `sentIds` durante toda la vida del Change Stream activo. Cuando MongoDB emite un cambio, se procesan solo las entradas cuyo `_id` no esté ya en `sentIds`, evitando el doble procesado si el mismo documento se reve por replicación o reconexión.

La limpieza del Set se activa cuando `sentIds.size > MAX_ENTRADAS * 2` (400): en ese momento se eliminan todos los IDs que ya no están en el documento actual del buzón. Dado que el documento no puede tener más de 200 entradas, el Set nunca debería tener más de ~400 IDs activos por definición.

### Vaciado atómico al iniciar sesión (`Revisar_Buzon_Usuario`)

`Revisar_Buzon_Usuario` en `BuzonRepository.js` hace un `findByIdAndUpdate` con `{ $set: { entrada: [], updatedAt: new Date() } }` y `new: false` (devuelve el documento _antes_ del vaciado). Esto garantiza que la lectura y el vaciado son atómicos: no hay ventana de tiempo en la que otra entrada pueda insertarse y perderse.

### Optimización de cola en reconexión

Al reconectar (flag `primer_contacto = true` en `buzonAPI.js`), se filtra el resultado con `optimizar_cola_entradas_buzon` antes de enviarlo al frontend. Esta función agrupa entradas del mismo tipo y chat (tipos 0, 3, 4) para evitar que el usuario vea decenas de banners tras una desconexión larga.

### TTL de MongoDB (limpieza de cuentas inactivas)

El índice TTL vive sobre el campo `updatedAt` del documento de buzón:

```js
BuzonSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90 días
```

`updatedAt` se actualiza en cada escritura del repositorio:
- `Añadir_Entrada_Buzon_Usuario` → `$set: { updatedAt: new Date() }` incluido en el `bulkWrite`.
- `Revisar_Buzon_Usuario` → `$set: { updatedAt: new Date() }` incluido en el `findByIdAndUpdate`.

Así el TTL solo expira documentos de cuentas **completamente inactivas** desde hace más de 90 días. Para usuarios activos, `updatedAt` se renueva con cada mensaje recibido o cada inicio de sesión, por lo que el documento persiste indefinidamente mientras la cuenta siga en uso.

> Usar un campo estático (`createdAt`) en el TTL habría causado que los documentos de usuarios activos se eliminaran cada ~90 días desde su creación y se recrearan vacíos. `updatedAt` es el campo correcto.

---

## 7. Configuración en ajustes

Todos los ajustes de notificación se almacenan en `ajustes_app.json` (local, por dispositivo) a través de `getAjustesAppFile` / `saveAjustesAppFile`. Los valores por defecto están en `backend/STORAGE/ajustes_defecto.js`. La UI para configurarlos está en Ajustes → Notificaciones (`#cuerpo-ajustes-noti` en `home.html`).

Los ajustes de OS se leen sincrónicamente en el momento en que llega cada evento. Los ajustes de correo se comprueban de forma asíncrona antes de cada envío.
