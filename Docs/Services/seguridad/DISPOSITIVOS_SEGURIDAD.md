# Sistema de Seguridad de Dispositivos

Este documento describe los tres sistemas de control de acceso por dispositivo implementados en Ravage: dispositivos de confianza, bloqueo por cuenta de usuario y bloqueo global de la aplicación.

---

## 1. Dispositivos de confianza

### Propósito

Cuando un usuario inicia sesión introduce sus credenciales y recibe un código de verificación por correo. Si marca su dispositivo como "de confianza", ese paso de verificación por correo se omite en futuros inicios de sesión desde el mismo dispositivo.

### Cómo funciona

1. Tras validar el código de correo en el login, la app ofrece marcar el dispositivo como de confianza.
2. Si acepta, se genera un JWT con duración de 365 días (`tipo: 'confianza'`).
3. El token se guarda cifrado en dos sitios:
   - **Archivo local** (`dispositivoConfianza`) — para que la app lo lea sin tocar la DB en cada arranque.
   - **Colección `tokendpc`** en MongoDB — para validación cruzada y gestión remota.
4. En cada login, antes de enviar el código por correo, la app comprueba:
   - Existe el archivo local con el token.
   - El JWT no ha expirado.
   - El token existe en `tokendpc` ligado al mismo `correo_hash` e `id_dp_hash`.
   - Si las tres condiciones se cumplen, se salta la verificación.
5. Se envía un correo de aviso al usuario cada vez que se añade o revoca la confianza de un dispositivo.

### Datos almacenados en `tokendpc`

| Campo | Tipo | Descripción |
|---|---|---|
| `correo` | Cifrado (AES-256-GCM) | Correo del usuario |
| `correo_hash` | SHA-256 | Para búsquedas en DB |
| `token` | SHA-256 | Hash del JWT (nunca el token en claro) |
| `id_dp` | Cifrado (AES-256-GCM) | ID de máquina original |
| `id_dp_hash` | SHA-256 | Para búsquedas en DB |
| `os` | Cifrado (AES-256-GCM) | Sistema operativo del dispositivo |
| `nombre` | Cifrado (AES-256-GCM) | Modelo/hardware del dispositivo |

No tiene TTL — se elimina explícitamente al revocar.

### Revocar confianza

- **Desde ajustes de cuenta** (`bt-revocar-dispositivo-confianza`): revoca solo el dispositivo actual. Elimina el registro de `tokendpc` y borra el archivo local.
- **Desde el panel de gestión** (`bt-revocar-confianza`): permite revocar cualquier dispositivo listado, incluido el actual. Al revocar el actual, también borra el archivo local.

---

## 2. Bloqueo por cuenta (usuario)

### Propósito

El usuario puede bloquear un dispositivo específico para que no pueda acceder a su cuenta, aunque conozca las credenciales. Es independiente del dispositivo desde el que se ejecute la acción.

### Cómo funciona

1. Desde el panel de gestión de dispositivos, el usuario pulsa "Bloquear" en cualquier dispositivo que no sea el propio.
2. La app:
   - Busca la información del dispositivo (`os`, `nombre`) en `tksession` o `tokendpc` antes de eliminarlo.
   - Inserta un registro en `dpbloqueado`.
   - Revoca todas las sesiones activas del dispositivo (`tksession`).
   - Revoca la confianza del dispositivo (`tokendpc`).
   - Si el dispositivo bloqueado es el actual (caso poco habitual), limpia también los archivos locales.
3. Se envía un correo de aviso al usuario.
4. En cada login y autologin, antes de continuar, se comprueba si el `id_dp_hash` del dispositivo aparece en `dpbloqueado` para ese `correo_hash`. Si existe, el acceso se deniega.

### Datos almacenados en `dpbloqueado`

| Campo | Tipo | Descripción |
|---|---|---|
| `correo` | Cifrado (AES-256-GCM) | Correo del usuario |
| `correo_hash` | SHA-256 | Para búsquedas en DB |
| `id_dp` | Cifrado (AES-256-GCM) / null | ID de máquina (null si se bloqueó desde el panel, donde solo se conoce el hash) |
| `id_dp_hash` | SHA-256 | Para búsquedas en DB |
| `os` | Cifrado (AES-256-GCM) | Sistema operativo |
| `nombre` | Cifrado (AES-256-GCM) | Modelo/hardware |
| `fecha_bloqueo` | Date | Cuándo se bloqueó |

### Desbloquear

Desde el mismo panel, la sección "Dispositivos bloqueados" muestra todos los dispositivos bloqueados de la cuenta. El botón "Desbloquear" elimina el registro de `dpbloqueado` y envía un correo de aviso.

---

## 3. Bloqueo global de la aplicación (mantenedor)

### Propósito

Bloquea el acceso de un dispositivo a la aplicación completa, independientemente de qué cuenta intente usar. Es irreversible para el usuario — solo el mantenedor puede levantarlo desde la base de datos.

### Cómo funciona

**Automático (rate limiting):**

1. En cada intento de login o registro, el sistema comprueba un rate limiter en memoria (7 intentos / 15 min por `id_dp_hash`).
2. Si se supera el límite, se registra una infracción en la colección `ratelimitaudit`.
3. Si el mismo dispositivo acumula 5 infracciones en el mismo día, se inserta automáticamente en `appblockeddevices` y queda bloqueado de forma permanente.

**Manual (mantenedor):**

El mantenedor inserta directamente en la colección `appblockeddevices` el `id_dp_hash` del dispositivo a bloquear.

Para conocer el hash de un dispositivo concreto, el usuario puede copiarlo desde el panel de gestión de dispositivos (botón "Hash dispositivo" junto al badge "Este dispositivo") y enviárselo al mantenedor.

### Datos almacenados en `appblockeddevices`

| Campo | Tipo | Descripción |
|---|---|---|
| `id_dp_hash` | SHA-256 (texto plano) | Hash del dispositivo. Texto plano para inserción manual |
| `razon` | String | Motivo del bloqueo |
| `fecha_bloqueo` | Date | Cuándo se bloqueó |

> `id_dp_hash` es texto plano intencionadamente — es un hash SHA-256 del ID de máquina, por lo que no expone el ID real, y debe ser legible para que el mantenedor pueda insertarlo a mano.

### Colección auxiliar `ratelimitaudit`

Lleva el recuento de infracciones diarias por dispositivo. Se resetea a 0 cada día (la fecha forma parte del índice único). No contiene información de usuario, solo `id_dp_hash`, `fecha` e `intentos`.

---

## Flujo de comprobaciones en el login

```
loginUsuario()
    │
    ├─ ¿id_dp_hash en appblockeddevices?  → Bloqueo global. Acceso denegado permanentemente.
    │
    ├─ ¿id_dp_hash + correo_hash en dpbloqueado?  → Bloqueo de cuenta. Acceso denegado para este usuario.
    │
    ├─ ¿Token de confianza local válido + en tokendpc?  → Login sin verificación por correo.
    │
    └─ Sin confianza  → Enviar código de verificación por correo. Requiere validación.
```

---

## Correos de aviso

Cada acción sobre dispositivos genera un correo al usuario:

| Acción | Template | Color |
|---|---|---|
| Dispositivo marcado como de confianza | `AvisoDispositivoConfianzaAnadido` | Verde |
| Confianza revocada | `AvisoDispositivoConfianzaRevocado` | Naranja |
| Sesión cerrada remotamente | `AvisoSesionCerrada` | Morado |
| Dispositivo bloqueado | `AvisoDispositivoBloqueado` | Rojo |
| Dispositivo desbloqueado | `AvisoDispositivoDesbloqueado` | Cyan |
