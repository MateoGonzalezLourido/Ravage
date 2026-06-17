# Sistema de Login y Gestión de Sesiones

Este documento describe el flujo completo de autenticación en Ravage: registro, login, verificación por correo, tokens de sesión, autologin y cierre de sesión.

---

## 1. Registro

### Flujo

1. El usuario introduce apodo, correo y contraseña.
2. La app valida el formato de los tres campos (sin tocar la DB aún).
3. Se comprueba en DB que el correo no esté ya registrado (`correo_hash`).
4. Si pasa, en background se ejecutan en paralelo:
   - **Hash de contraseña** con Argon2id (ver `Docs/Services/seguridad/HASHING_CONTRASENAS.md`).
   - **Generación de par de claves X25519** para cifrado E2EE.
5. Se genera un código de verificación numérico aleatorio y se guarda en la colección `validationcodes` cifrado, vinculado al correo y al dispositivo.
6. Se envía el código por correo. El usuario tiene **10 minutos** y **5 intentos** para introducirlo.

### Validación del código de registro

1. Se busca el código en `validationcodes` por `correo_hash + hash(code) + id_dp_hash`.
2. Si es correcto, se crea el usuario en DB con la contraseña hasheada y la clave pública RSA.
3. La clave privada RSA se guarda en un archivo local cifrado (`identityFile`). **Nunca sale del dispositivo ni se sube a la DB.**
4. Se borra el código de `validationcodes`.
5. Se envía correo de confirmación de cuenta creada.

---

## 2. Login manual (credenciales)

### Flujo

```
loginUsuario()
    │
    ├─ 1. Validar formato correo + contraseña (sin DB)
    │
    ├─ 2. En paralelo:
    │      ├─ Leer archivo local dispositivoConfianza
    │      ├─ Leer archivo local omitirVerificacionCuentaFile
    │      ├─ Comprobar dpbloqueado en DB (¿bloqueado para esta cuenta?)
    │      └─ LoginUsuarioDB (¿credenciales correctas?)
    │
    ├─ 3. ¿Dispositivo bloqueado para esta cuenta? → Denegar acceso
    │
    ├─ 4. ¿Credenciales incorrectas? → Denegar + registrar intento fallido en rate limiter
    │
    ├─ 5. ¿Dispositivo de confianza válido?
    │      ├─ Sí → autoverificacion = true
    │      └─ No → comprobar token de omitir verificación (ver abajo)
    │
    ├─ 6. Si autoverificacion = true → entrar directamente (sin código)
    │      └─ Si mantenerSesion → generar JWT de sesión (7d) + guardar en archivo + DB
    │
    └─ 7. Si autoverificacion = false → generar código, guardarlo en cuentavalidationcode, enviarlo por correo
```

### Rate limiting en login

Antes de cualquier comprobación de credenciales, el IPC intercepta la llamada:

- **En memoria**: 7 intentos por dispositivo en ventana de 15 minutos.
- Si se supera: se registra una infracción en `ratelimitaudit` en DB.
- Si el mismo dispositivo acumula **5 infracciones en el mismo día**: bloqueo permanente en `appblockeddevices`.
- Tras un login exitoso: el contador en memoria se resetea a 0.

---

## 3. Verificación por correo en el login

Cuando el login no puede autoverificarse, el usuario recibe un código por correo.

### Flujo de ValidarCodeLogin

1. Se busca el código en `cuentavalidationcode` por `correo_hash + hash(code) + id_dp_hash`. El código expira en **10 minutos** y admite **5 intentos**.
2. Si es correcto:
   - Si `mantenerSesion` estaba activo → se genera un **JWT de sesión** (7 días) y se guarda en archivo local (`sessionFile`) y en DB (`tksession`).
   - Se genera un **token de omitir verificación** (90 minutos, colección `tokenvcv`) y se guarda en archivo local (`omitirVerificacionCuentaFile`).
   - Se borra el código de `cuentavalidationcode`.
3. Se ofrece al usuario marcar el dispositivo como de confianza (ver `DISPOSITIVOS_SEGURIDAD.md`).
4. Se envía correo de confirmación de inicio de sesión.

---

## 4. Token de omitir verificación (`tokenvcv`)

Es un mecanismo de conveniencia para no repetir el código por correo en logins muy seguidos.

- **Duración**: 90 minutos (TTL en MongoDB + JWT).
- **Colección**: `tokenvcv`, comparte esquema con `tksession`.
- **Funciona**: si el usuario cierra y reabre la app antes de los 90 min, el login lo detecta, valida el token en DB y omite el código.
- **Diferencia con dispositivo de confianza**: el token de omitir verificación es de corta duración y se genera siempre tras un login con código. El dispositivo de confianza dura 365 días y requiere que el usuario lo active explícitamente.

---

## 5. JWT de sesión (`tksession`)

Permite que el autologin funcione al arrancar la app sin pedir credenciales.

| Propiedad | Valor |
|---|---|
| Duración del JWT | 7 días |
| TTL en MongoDB | ~6,5 días (7d menos 90 min, para expirar antes que el JWT) |
| Colección | `tksession` |
| Archivo local | `sessionFile` |

### Datos almacenados en `tksession`

| Campo | Tipo | Descripción |
|---|---|---|
| `correo` | Cifrado (AES-256-GCM) | Correo del usuario |
| `correo_hash` | SHA-256 | Para búsquedas |
| `token` | SHA-256 | Hash del JWT (nunca el token en claro) |
| `expira` | Date | Para el TTL de MongoDB |
| `id_dp` | Cifrado (AES-256-GCM) | ID de máquina |
| `id_dp_hash` | SHA-256 | Para búsquedas |
| `os` | Cifrado (AES-256-GCM) | Sistema operativo |
| `nombre` | Cifrado (AES-256-GCM) | Modelo/hardware |

---

## 6. Autologin al arrancar la app

Se ejecuta automáticamente al iniciar antes de mostrar la pantalla de login.

### Flujo de autoLoginUsuario

```
autoLoginUsuario()
    │
    ├─ 1. Leer sessionFile → ¿existe token + correo?
    │      └─ No → mostrar pantalla de login
    │
    ├─ 2. ¿Formato de correo válido?
    │      └─ No → borrar sessionFile + mostrar login
    │
    ├─ 3. ¿Dispositivo bloqueado en dpbloqueado para este correo?
    │      └─ Sí → limpiar todos los archivos locales + mostrar login
    │
    ├─ 4. LoginUsuarioDB con el JWT del archivo
    │      ├─ Válido → cargar datos de sesión en memoria → entrar directamente
    │      └─ Inválido (token expirado o usuario borrado) → limpiar sessionFile + mostrar login
    │
    └─ 5. Asegurar identidad E2EE local (ver abajo)
```

> El autologin **no pasa por el rate limiter** — usa un JWT firmado, no credenciales bruteforceables.

---

## 7. Identidad E2EE local (`asegurarIdentidadLocal`)

Tras cualquier login exitoso (manual o autologin) se verifica que existe la clave privada RSA local.

- Si existe → sin acción.
- Si no existe (p.ej. primer login en un dispositivo nuevo, o archivo corrupto) → se regeneran las claves X25519 automáticamente, se actualiza la clave pública en DB y se guarda la privada en el archivo local.

> **Atención**: regenerar la identidad rompe el descifrado de mensajes anteriores en todos los chats, ya que fueron cifrados con la clave pública antigua. Es un escenario de último recurso.

---

## 8. Cierre de sesión

### Flujo de cerrarSesionUsuario

1. Se vacían todos los datos de sesión en memoria (`ACTUALIZAR_DATOS_LOGIN({ limpiar: true })`).
2. En paralelo:
   - Borrar `sessionFile`.
   - Borrar caché de usuarios en memoria.
   - Borrar caché de archivos descargados.
   - Eliminar el JWT de `tksession` en DB.
3. La app se reinicia (`app.relaunch() + app.exit(0)`).

> El archivo `dispositivoConfianza` y `omitirVerificacionCuentaFile` **no se borran** al cerrar sesión, por lo que el próximo login puede aprovecharlos.

---

## 9. Tokens — resumen de duraciones

| Token | JWT | TTL MongoDB | Colección | Archivo local |
|---|---|---|---|---|
| Sesión | 7 días | ~6,5 días | `tksession` | `sessionFile` |
| Omitir verificación | 90 min | 90 min | `tokenvcv` | `omitirVerificacionCuentaFile` |
| Confianza dispositivo | 365 días | Sin TTL (sin expiración) | `tokendpc` | `dispositivoConfianza` |
| Código de registro | — | 10 min | `validationcodes` | — |
| Código de login | — | 10 min | `cuentavalidationcode` | — |

---

## 10. Archivos locales de sesión

Todos los archivos se guardan cifrados en el directorio de datos de la app (fuera del repo).

| Archivo | Contenido | Cuándo se crea | Cuándo se borra |
|---|---|---|---|
| `sessionFile` | `{ username, token }` | Login con `mantenerSesion` | Cierre de sesión / token inválido |
| `omitirVerificacionCuentaFile` | `{ username, token }` | Tras validar código de login | Token expirado / inválido |
| `dispositivoConfianza` | `{ username, token }` | Al marcar como de confianza | Al revocar confianza |
| `identityFile` | Claves X25519 privada + pública | Registro / regeneración | Nunca (persiste entre sesiones) |
| `securityPin` | `{ correo, pinHash }` | Al configurar el PIN | Al borrar el PIN |
