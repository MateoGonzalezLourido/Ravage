# Claves del sistema

Ravage maneja varios tipos de claves criptográficas con propósitos distintos. Este documento describe cada una: su origen, formato, ciclo de vida y dónde se usa.

---

## 1. Mapa general de claves

| Clave | Origen | Formato en memoria | Formato en reposo | Propósito |
|---|---|---|---|---|
| `secretKey` (usuario) | `randomBytes(32)` al registrar | `Buffer` | `EncryptedDataSchema` en MongoDB (cifrado con `INTERNAL_ENCRYPTION_KEY`) | Cifra archivos locales del usuario (ajustes, historial, etc.) |
| `SECRET_KEY_COKKIE` | Variable de entorno (hex) | `Buffer` | `.env.secret` | Cifra archivos locales de sesión y configuración de la app |
| `SECRET_KEY_PRIVATE` | Variable de entorno (hex) | `Buffer` | `.env.secret` | Cifra el archivo de identidad E2EE (claves privadas X25519) en disco |
| `INTERNAL_ENCRYPTION_KEY` | Variable de entorno (hex) | `Buffer` | `.env.secret` | Cifra datos sensibles almacenados en MongoDB (buzón, `asunto` y `key_enc` de los mensajes, etc.) y, si falta `HMAC_SECRET`, keyea también los `*_hash` |
| `HMAC_SECRET` | Variable de entorno | `String` | `.env.secret` | Keyea los HMAC-SHA256 de búsqueda (`correo_hash`, `id_dp_hash`, `idamigo_hash`). **Opcional**: si no está definida cae a `INTERNAL_ENCRYPTION_KEY` — ver §3.1 |
| Chain key (ratchet E2EE) | `randomBytes(32)` al crear chat | Hex string | Hex string (X25519-wrapped en `ratchet_keys`) | Clave raíz del ratchet de mensajes por chat |
| Clave privada X25519 | Generada con `generateKeyPairSync('x25519')` | PEM string | Cifrada con `SECRET_KEY_PRIVATE` en `identityFile` | Descifra chain keys E2EE (ECDH) |

---

## 2. `secretKey` — clave simétrica del usuario

### Origen y formato

Generada al registrar el usuario con `randomBytes(32)` (32 bytes, 256 bits). Se almacena **cifrada** en MongoDB como `EncryptedDataSchema` usando `INTERNAL_ENCRYPTION_KEY` + AES-256-GCM. El hex del buffer es el plaintext cifrado.

Al cargar en sesión, `desencriptarDatosSistema(dt.secretKey)` devuelve el hex → `Buffer.from(hex, 'hex')` → Buffer de 32 bytes que se pone en memoria con `setSecretKEY(buffer)`.

Esto significa que comprometer MongoDB sin tener también la `INTERNAL_ENCRYPTION_KEY` (almacenada en el vault del SO) no es suficiente para obtener las claves de cifrado de los usuarios.

### Ciclo de vida

```
randomBytes(32)                          ← registro o rotación
      │
      ▼
User.secretKey (EncryptedDataSchema)     ← persistencia en MongoDB
      │
      ▼ (login / autologin)
Variables_sesion.setSecretKEY(buffer)    ← sesión en memoria
      │
      ▼ (cifrar/descifrar archivos)
controladorArchivos → createCipheriv / createDecipheriv
```

### Rotación

`ActualizarSecretKeyUsuario()` en `UserRepository.js` genera un nuevo `randomBytes(32)`, actualiza la DB y sincroniza la caché de sesión. Se llama automáticamente cuando la clave no existe al intentar cifrar.

---

## 3. Claves de entorno (`SECRET_KEY_*`)

Las tres claves de entorno son cadenas hexadecimales de 64 caracteres (32 bytes). Se convierten a `Buffer` una sola vez de forma perezosa al primer uso:

```js
_SECRET_KEY_COKKIE = Buffer.from(process.env.SECRET_KEY_COKKIE, 'hex');
_SECRET_KEY_PRIVATE = Buffer.from(process.env.SECRET_KEY_PRIVATE, 'hex');
```

Si la variable de entorno no está definida al intentar usarla, la app lanza un error y aborta la operación (fail-closed).

### Qué cifra cada una

| Clave | Archivos que cifra (`RTDF` en `controladorArchivos.js`) |
|---|---|
| `SECRET_KEY_COKKIE` | `sessionFile`, `cacheChatsFrecuentes`, `cacheArchivosDescargados`, `dispositivoConfianza`, `omitirVerificacionCuentaFile`, `cacheHistorialBusquedasAñadir`, `securityPin` |
| `SECRET_KEY_PRIVATE` | `identity` (archivo con las claves privadas X25519 de mensajería E2EE) |
| `secretKey` (usuario, desde MongoDB) | Todo lo demás: ajustes de app, datos de usuario, etc. |

La función `CifrarDatosArchivos` y `readFileSession` en `controladorArchivos.js` seleccionan la clave adecuada según la ruta del archivo antes de llamar a AES-256-GCM.

### Generación de nuevas claves de entorno

```bash
openssl rand -hex 32
```

Ejecutar una vez por cada clave. Las tres deben ser distintas entre sí.

### 3.1 `HMAC_SECRET` — fallback deliberado (deuda técnica)

`hashDatosSistema()` (`cryptoService.js`) usa `process.env.HMAC_SECRET` como clave del
HMAC-SHA256 que genera los índices de búsqueda `correo_hash`, `id_dp_hash` e
`idamigo_hash`. Si la variable **no** está definida, cae a `getSystemKey()`, es decir a
`INTERNAL_ENCRYPTION_KEY`, y emite **una sola vez** (flag `_aviso_hmac_emitido`):

```
[Crypto] HMAC_SECRET no definida: se reutiliza INTERNAL_ENCRYPTION_KEY para los
hashes de búsqueda (separación de claves degradada).
```

Esto rompe la separación de claves a propósito, no por descuido. Hacerla obligatoria
hoy sería un cambio incompatible: **todos** los `correo_hash` / `id_dp_hash` ya
guardados en MongoDB se calcularon con la clave de sistema, así que con otro secreto el
`User.findOne({ correo_hash })` del login dejaría de encontrar a ningún usuario
existente (y lo mismo con dispositivos de confianza, bloqueos y auditoría de rate
limit, indexados por `id_dp_hash`).

Migración pendiente, en este orden:

1. Añadir una `HMAC_SECRET` propia al baúl de entorno.
2. Recalcular todos los campos `*_hash` de la BD con el nuevo secreto (requiere
   descifrar los `EncryptedData` de origen, lo que solo es posible teniendo
   `INTERNAL_ENCRYPTION_KEY`).
3. Solo entonces hacer `HMAC_SECRET` fail-closed como el resto de claves.

Mientras tanto, comprometer `INTERNAL_ENCRYPTION_KEY` implica también poder calcular el
`correo_hash` de cualquier correo que se adivine: el HMAC deja de proteger el índice
frente a búsquedas por diccionario.

### 3.2 Baúl de entorno — `env_vault.js` + `rutas_recursos.js`

Los `.env` no se distribuyen en claro con la app instalada. Al arrancar (tras
`app.whenReady`), `backend/utils/env_vault.js`:

1. Busca los `.env*` (excluyendo `.example`) en el directorio `env/`.
2. Los cifra con `safeStorage` de Electron — libsecret en Linux, DPAPI en Windows,
   Keychain en macOS — y los guarda como `<userData>/env_vault/<nombre>.enc`.
3. **Borra los `.env` originales del disco.**
4. En arranques posteriores carga las variables del baúl a `process.env`.

La resolución del directorio `env/` está centralizada en el módulo
`backend/utils/rutas_recursos.js` (`dentroDeAsar()`, `resolverExtraResource(nombre)`,
`resolverDirEnv()`): en desarrollo apunta al árbol del proyecto y en producción a
`process.resourcesPath/env`, ya que el código corre dentro de `app.asar` y `env/` se
copia fuera del asar vía `extraResources`.

> **Corregido**: `env_vault.js` resolvía la ruta con
> `path.resolve(__dirname, '../../env')`, que en producción apunta dentro del asar y
> por tanto nunca encontraba los `.env`. El resultado era que en las builds instaladas
> el baúl no se llenaba y las credenciales se quedaban **en claro** en
> `resources/env/`. Ahora usa `resolverDirEnv()`.

---

## 4. Chain keys (ratchet E2EE)

Las chain keys implementan un ratchet de tipo Sender Key, similar al protocolo Signal pero simplificado.

### Formato y convención

Las chain keys se almacenan y transportan siempre como **cadenas hexadecimales de 64 caracteres** (representación de 32 bytes, todos caracteres ASCII). Esta convención es segura frente al round-trip de AES-GCM porque UTF-8 no corrompe ASCII.

### Flujo de la chain key

```
[Crear chat]
randomBytes(32).toString('hex')       ← chain key inicial (hex, 64 chars)
      │
      ▼
cifrarConX25519(chainKey, publicKey)  ← ECDH efímero + HKDF + AES-256-GCM
      │                                 genera: { ephPub, iv, data, tag }
      ▼
ratchet_keys[].clave_envuelta         ← subdocumento { ephPub, iv, data, tag } en MongoDB

[Enviar / recibir mensaje]
descifrarConX25519(clave_envuelta, privateKey)   ← devuelve la chain key como hex string
      │
      ▼
ratchetChainKey(chainKeyHex)
  ├─ messageKey   = HMAC-SHA256(Buffer.from(hex, 'hex'), 0x01)  → Buffer (clave AES para este mensaje)
  └─ nextChainKey = HMAC-SHA256(Buffer.from(hex, 'hex'), 0x02)  → hex string (siguiente estado del ratchet)
```

### Por qué X25519 en lugar de RSA-OAEP

Con RSA-OAEP, comprometer una clave privada permite descifrar **todos** los `clave_envuelta` pasados almacenados en la DB. Con X25519 efímero, cada `clave_envuelta` se cifró con una clave efímera de un solo uso: comprometer la clave privada de identidad no permite descifrar mensajes anteriores (**forward secrecy** en la distribución de chain keys).

### Cómo funciona el cifrado X25519

Para cada par (emisor, receptor) al crear o rotar claves de chat:

1. Se genera un par X25519 **efímero** (vive solo durante la operación).
2. `ECDH(ephPriv, recipientPub)` → 32 bytes de secreto compartido.
3. `HKDF-SHA256(sharedSecret, info='ravage-ck-wrap')` → 32 bytes de wrapping key.
4. `AES-256-GCM(chainKeyHex, wrappingKey)` → `{ iv, data, tag }`.
5. Se almacena `{ ephPub (raw hex 32B), iv, data, tag }` en `ratchet_keys[].clave_envuelta`.

Para descifrar: receptor hace `ECDH(privKey, ephPub)` → misma wrapping key → descifra con AES-GCM.

### Re-envoltura (`reWrapChainKey`) y el campo `counter`

Cuando una chain key solo se puede desenvolver con una clave **de soporte** (no la
principal), `messageCryptoService.js` programa un `reWrapChainKey(...)` en segundo plano
que la vuelve a envolver bajo la clave pública principal actual. Esa operación **solo
escribe `clave_envuelta`; nunca toca `counter`**. El `counter` se usa únicamente dentro
del filtro, con `$elemMatch`:

```js
ChatsRavage.updateOne(
  { _id: chatId,
    ratchet_keys: { $elemMatch: { emisor_id, receptor_id, counter } } },
  { $set: { "ratchet_keys.$.clave_envuelta": nuevaClave } }
);
```

Así la escritura es atómica e idempotente: si el ratchet avanzó entre la lectura y la
escritura, la `ck_hex` que se iba a guardar ya está obsoleta y el `updateOne`
simplemente no encaja (no-op, `matchedCount === 0`).

> **Corregido**: antes se hacía `$set` también del `counter` leído. Cuando
> `emisor_id === receptor_id === usuario propio`, ese `$set` competía con el `$inc` que
> `MessageRepository.ENVIAR_MENSAJE` aplica a la **misma** entrada y podía **retroceder
> el contador**, dejándolo desincronizado de la clave envuelta y volviendo
> irrecuperables mensajes antiguos en `getMessageKey()`.

### Archivos relevantes

| Archivo | Rol |
|---|---|
| `ChatRepository.js` | Genera la chain key inicial y la cifra con X25519 para cada miembro |
| `cryptoService.js` | `ratchetChainKey`, `cifrarConX25519`, `descifrarConX25519`, `descifrarConX25519Multi` |
| `cryptoWorker.js` | Worker pool: `_cifrarConX25519`, `_descifrarConX25519`, `_ratchetChainKey` |
| `messageCryptoService.js` | Orquesta el descifrado de mensajes usando el ratchet; `reWrapChainKey` (re-envoltura a la clave principal). **No** persiste el estado del ratchet del receptor: `_persistirRatchetState` y `_persistirRatchetStateDesdeBatch` fueron eliminadas |
| `Chat.js` (modelo) | `clave_envuelta: { ephPub, iv, data, tag }` — subdocumento en MongoDB |

---

## 5. Resumen de algoritmos por clave

| Clave | Algoritmo de cifrado en reposo | Algoritmo de uso |
|---|---|---|
| `secretKey` usuario | AES-256-GCM con `INTERNAL_ENCRYPTION_KEY` (en MongoDB) | AES-256-GCM (cifra archivos locales) |
| `SECRET_KEY_COKKIE` | En `.env.secret` (protegido por vault del SO) | AES-256-GCM |
| `SECRET_KEY_PRIVATE` | En `.env.secret` (protegido por vault del SO) | AES-256-GCM |
| `INTERNAL_ENCRYPTION_KEY` | En `.env.secret` | AES-256-GCM (cifra datos en MongoDB) |
| Chain key | X25519+HKDF+AES-256-GCM (efímero por operación) | HMAC-SHA256 (ratchet) → AES-256-GCM (mensajes) |
| Clave privada X25519 | AES-256-GCM con `SECRET_KEY_PRIVATE` | ECDH (descifrar chain keys envueltas) |

---

## 6. Limitación conocida: la copia paralela bajo `INTERNAL_ENCRYPTION_KEY`

`INTERNAL_ENCRYPTION_KEY` **no es una clave por usuario ni por dispositivo**: es una
variable de entorno que viaja con la build, o sea que tiene el **mismo valor en todas
las instalaciones**. Y `ENVIAR_MENSAJE` (`backend/repositories/MessageRepository.js`)
guarda, junto al ciphertext E2EE (`encriptado`), una segunda copia de los datos cifrada
con esa clave, en **todos** los mensajes de **todos** los chats:

| Campo | Cifrado con | Expone |
|---|---|---|
| `contenido[0].asunto` | `INTERNAL_ENCRYPTION_KEY` | El texto completo del mensaje |
| `contenido[0].archivos[].nombre` | `INTERNAL_ENCRYPTION_KEY` | Los nombres de los adjuntos |
| `contenido[0].archivos[].key_enc` | `INTERNAL_ENCRYPTION_KEY` | La clave AES-256-GCM del adjunto en GridFS, es decir, el archivo entero |

Consecuencia: quien tenga acceso de lectura a MongoDB **y** la
`INTERNAL_ENCRYPTION_KEY` de la build puede leer todos los mensajes y descifrar todos
los adjuntos sin la clave privada X25519 de nadie y sin tocar el ratchet. Todo el
aparato X25519 + Sender Key Ratchet de §4 protege únicamente el campo `encriptado`, que
convive con una copia legible bajo una clave compartida.

Esa copia es también lo que permite la cascada de recuperación al descifrar (leer tu
propio historial tras perder el estado del ratchet), pero eso es una consecuencia de la
debilidad, no una justificación.

**Estado: sin arreglar.** Es la limitación de seguridad más importante del sistema hoy.
Detalle completo y posibles arreglos en `Docs/backend/CRYPTO_SECURITY.md` §3.7.
