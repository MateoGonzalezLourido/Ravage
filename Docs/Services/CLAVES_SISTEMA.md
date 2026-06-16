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
| Chain key (ratchet E2EE) | `randomBytes(32)` al crear chat | Hex string | Hex string (RSA-wrapped en `ratchet_keys`) | Clave raíz del ratchet de mensajes por chat |
| Clave privada RSA | Generada con `generateKeyPairSync` | PEM string | Cifrada con `SECRET_KEY_PRIVATE` en `identityFile` | Descifra chain keys y mensajes E2EE |

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

Las chain keys se almacenan y transportan siempre como **cadenas hexadecimales de 64 caracteres** (representación de 32 bytes). Este convenio es intencional:

- `descifrarConPrivada()` en `cryptoService.js` devuelve `.toString('utf8')`. Una cadena hex sobrevive sin corrupción a este round-trip (todos sus caracteres son ASCII imprimibles).
- Si se almacenaran como bytes binarios, el `.toString('utf8')` los corrompería al encontrar secuencias de bytes no válidas UTF-8.

### Flujo de la chain key

```
[Crear chat]
randomBytes(32).toString('hex')       ← chain key inicial (hex, 64 chars)
      │
      ▼
cifrarConPublica(chainKey, publicKey) ← RSA-OAEP cifra los 64 bytes UTF-8
      │
      ▼
ratchet_keys[].clave_envuelta         ← almacenada cifrada en MongoDB por par emisor→receptor

[Enviar / recibir mensaje]
descifrarConPrivada(clave_envuelta)   ← devuelve la chain key como hex string
      │
      ▼
ratchetChainKey(chainKeyHex)
  ├─ messageKey   = HMAC-SHA256(Buffer.from(hex, 'hex'), 0x01)  → Buffer (clave AES para este mensaje)
  └─ nextChainKey = HMAC-SHA256(Buffer.from(hex, 'hex'), 0x02)  → hex string (siguiente estado del ratchet)
```

El `nextChainKey` vuelve a ser hex para mantener el contrato y poder pasarse a la siguiente iteración de `ratchetChainKey`.

### Archivos relevantes

| Archivo | Rol |
|---|---|
| `ChatRepository.js` | Genera la chain key inicial y la cifra con RSA pública de cada miembro |
| `cryptoService.js` | `ratchetChainKey`, `cifrarConPublica`, `descifrarConPrivada` |
| `cryptoWorker.js` | Worker pool: réplica de `_ratchetChainKey` y `_descifrarConPrivada` para operaciones paralelas |
| `messageCryptoService.js` | Orquesta el descifrado de mensajes usando el ratchet |
| `Chat.js` (modelo) | `clave_envuelta: String` — la chain key cifrada con RSA |

---

## 5. Resumen de algoritmos por clave

| Clave | Algoritmo de cifrado en reposo | Algoritmo de uso |
|---|---|---|
| `secretKey` usuario | — (en MongoDB, protegido por acceso a la DB) | AES-256-GCM (cifra archivos locales) |
| `SECRET_KEY_COKKIE` | En `.env.secret` (protegido por vault del SO) | AES-256-GCM |
| `SECRET_KEY_PRIVATE` | En `.env.secret` (protegido por vault del SO) | AES-256-GCM |
| `INTERNAL_ENCRYPTION_KEY` | En `.env.secret` | AES-256-GCM (cifra datos en MongoDB) |
| Chain key | RSA-OAEP (SHA-256) con clave pública del receptor | HMAC-SHA256 (ratchet) → AES-256-GCM (mensajes) |
| Clave privada RSA | AES-256-GCM con `SECRET_KEY_PRIVATE` | RSA-OAEP (descifrar chain keys) |
