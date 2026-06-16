# Hashing de contraseñas y datos sensibles

Ravage usa **Argon2id** para el hash de contraseñas, PINs y códigos de verificación. Reemplazó a bcrypt en favor de mayor resistencia a ataques con hardware especializado (GPUs/ASICs), tal como recomienda OWASP.

---

## 1. Algoritmo y parámetros

| Parámetro | Valor | Significado |
|---|---|---|
| Algoritmo | `argon2id` | Híbrido de Argon2i (resistente a side-channel) y Argon2d (resistente a GPU) |
| Memoria (`m`) | 65 536 KB (64 MB) | Coste de memoria por operación de hash |
| Iteraciones (`t`) | 3 | Número de pasadas |
| Paralelismo (`p`) | 4 | Hilos en paralelo |

Los parámetros son los valores por defecto del módulo npm `argon2` y superan el mínimo recomendado por OWASP (m=19456, t=2, p=1).

El salt se genera aleatoriamente en cada llamada a `hash()` y se embebe en el resultado, por lo que no hay que gestionarlo manualmente. El formato del hash resultante es:

```
$argon2id$v=19$m=65536,t=3,p=4$<salt_base64>$<hash_base64>
```

---

## 2. Dónde se usa

| Dato | Función | Archivo |
|---|---|---|
| Contraseña de usuario (registro) | `hash(password)` | `sesionUsuario.js` |
| Contraseña de usuario (cambio de contraseña) | `hash(password)` | `Usuario.js` |
| Código de verificación (registro, cambio de datos) | `hash(code)` | `Usuario.js` |
| PIN de seguridad local | `hash(pin)` | `session_ipc.js` |

La verificación en todos los casos usa `compare(plaintext, storedHash)`, que internamente llama a `argon2.verify(storedHash, plaintext)`.

---

## 3. Interfaz en `libs.js`

```js
// Hash — siempre Argon2id, sin segundo argumento de "rondas"
export const hash = (password) => argon2.hash(password, { type: argon2.argon2id });

// Verificación — orden (plaintext, storedHash) igual que tenía bcrypt para compatibilidad de callers
export const compare = (password, storedHash) => argon2.verify(storedHash, password);
```

Los callers importan `{ hash, compare }` de `../utils/libs.js` sin necesidad de conocer el algoritmo subyacente.

---

## 4. Lo que se eliminó

| Eliminado | Motivo |
|---|---|
| Dependencia `bcrypt` | Reemplazada por `argon2` |
| Variable de entorno `SALTOS_ENCRIPTAR_CONTRASENA` | Argon2 no usa "rondas" — los parámetros están en el código |
| `const saltos_contraseña` en `sesionUsuario.js` | Innecesario |
| Segundo argumento numérico en todas las llamadas a `hash()` | Argon2 no lo acepta |

> `saltos_code` en `Usuario.js` era además una variable indefinida (bug latente): se usaba sin declararse. El cambio a Argon2 lo eliminó sin efecto secundario porque la rama de código que la usaba nunca había generado un error visible (los códigos de verificación no se hasheaban correctamente).

---

## 5. Hashes que NO usan Argon2

| Dato | Algoritmo | Motivo |
|---|---|---|
| `correo_hash`, `id_dp_hash`, `idamigo_hash` | SHA-256 (HMAC con clave interna) | Son índices de búsqueda en MongoDB, no contraseñas. Velocidad necesaria; el HMAC con clave secreta los protege de rainbow tables |
| Token de sesión JWT (campo `token` en `tksession`) | SHA-256 | Hash de referencia rápida; el JWT ya tiene firma criptográfica propia |
| Código de verificación almacenado en `validationcodes` | **Argon2id** | Aunque el código es de corta duración, se hashea para protegerlo si la DB se compromete |
