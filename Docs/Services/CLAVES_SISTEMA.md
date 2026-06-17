# Claves del sistema

Ravage maneja varios tipos de claves criptográficas con propósitos distintos. Este documento describe cada una: su origen, formato, ciclo de vida y dónde se usa.

---

## 1. Mapa general de claves

| Clave | Origen | Formato en memoria | Formato en reposo | Propósito |
|---|---|---|---|---|
| `secretKey` (usuario) | `randomBytes(32)` al registrar | `Buffer` | `BinData` en MongoDB | Cifra archivos locales del usuario (ajustes, historial, etc.) |
| `SECRET_KEY_COKKIE` | Variable de entorno (hex) | `Buffer` | `.env.secret` | Cifra archivos locales de sesión y configuración de la app |
| `SECRET_KEY_PRIVATE` | Variable de entorno (hex) | `Buffer` | `.env.secret` | Cifra el archivo de identidad E2EE (clave privada RSA) en disco |
| `INTERNAL_ENCRYPTION_KEY` | Variable de entorno (hex) | `Buffer` | `.env.secret` | Cifra datos sensibles almacenados en MongoDB (buzón, etc.) |
| Chain key (ratchet E2EE) | `randomBytes(32)` al crear chat | Hex string | Hex string (X25519-wrapped en `ratchet_keys`) | Clave raíz del ratchet de mensajes por chat |
| Clave privada X25519 | Generada con `generateKeyPairSync('x25519')` | PEM string | Cifrada con `SECRET_KEY_PRIVATE` en `identityFile` | Descifra chain keys E2EE (ECDH) |

---

## 2. `secretKey` — clave simétrica del usuario

### Origen y formato

Generada al registrar el usuario con `randomBytes(32)` (32 bytes, 256 bits). Se almacena directamente como `Buffer` en MongoDB (campo `secretKey` del schema `User`, tipo Mongoose `Buffer` → MongoDB `BinData`).

Antes se almacenaba como cadena hexadecimal (64 chars). El cambio a `Buffer` elimina la conversión `Buffer.from(key, "hex")` en cada uso y reduce el tamaño en DB a la mitad.

### Ciclo de vida

```
randomBytes(32)                          ← registro o rotación
      │
      ▼
User.secretKey (BinData en MongoDB)      ← persistencia
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
| `SECRET_KEY_PRIVATE` | `identity` (archivo con claves RSA privadas de mensajería E2EE) |
| `secretKey` (usuario, desde MongoDB) | Todo lo demás: ajustes de app, datos de usuario, etc. |

La función `CifrarDatosArchivos` y `readFileSession` en `controladorArchivos.js` seleccionan la clave adecuada según la ruta del archivo antes de llamar a AES-256-GCM.

### Generación de nuevas claves de entorno

```bash
openssl rand -hex 32
```

Ejecutar una vez por cada clave. Las tres deben ser distintas entre sí.

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

### Archivos relevantes

| Archivo | Rol |
|---|---|
| `ChatRepository.js` | Genera la chain key inicial y la cifra con X25519 para cada miembro |
| `cryptoService.js` | `ratchetChainKey`, `cifrarConX25519`, `descifrarConX25519`, `descifrarConX25519Multi` |
| `cryptoWorker.js` | Worker pool: `_cifrarConX25519`, `_descifrarConX25519`, `_ratchetChainKey` |
| `messageCryptoService.js` | Orquesta el descifrado de mensajes usando el ratchet |
| `Chat.js` (modelo) | `clave_envuelta: { ephPub, iv, data, tag }` — subdocumento en MongoDB |

---

## 5. Resumen de algoritmos por clave

| Clave | Algoritmo de cifrado en reposo | Algoritmo de uso |
|---|---|---|
| `secretKey` usuario | — (en MongoDB, protegido por acceso a la DB) | AES-256-GCM (cifra archivos locales) |
| `SECRET_KEY_COKKIE` | En `.env.secret` (protegido por vault del SO) | AES-256-GCM |
| `SECRET_KEY_PRIVATE` | En `.env.secret` (protegido por vault del SO) | AES-256-GCM |
| `INTERNAL_ENCRYPTION_KEY` | En `.env.secret` | AES-256-GCM (cifra datos en MongoDB) |
| Chain key | X25519+HKDF+AES-256-GCM (efímero por operación) | HMAC-SHA256 (ratchet) → AES-256-GCM (mensajes) |
| Clave privada X25519 | AES-256-GCM con `SECRET_KEY_PRIVATE` | ECDH (descifrar chain keys envueltas) |
