# Variables de Entorno

Hay dos archivos `.env` necesarios para arrancar la app:

- `.env.secret` — URI de MongoDB, API keys, claves de cifrado y secretos de autenticación.
- `.env.config` — Configuración interna de la app (no expuesta al usuario).

Ambos se colocan en `env/` antes del primer arranque. El vault los cifra automáticamente y los elimina del disco; a partir de ese momento las variables se leen desde el baúl cifrado.

En desarrollo `env/` es `<proyecto>/env`; en una build empaquetada el directorio se copia como
`extraResources` a `<instalación>/resources/env`. El vault localiza el correcto en cada caso mediante
`resolverDirEnv()` de `backend/utils/rutas_recursos.js` (ver [`vault.md`](vault.md)).

## Variables opcionales

| Variable | Comportamiento si falta |
|---|---|
| `HMAC_SECRET` | Aparece comentada en `.env.secret.example`. La usa `hashDatosSistema()` (`backend/services/cryptoService.js`) para los hashes deterministas de búsqueda (`correo_hash`, `id_dp_hash`). Si no está definida se recurre a la clave de sistema (`INTERNAL_ENCRYPTION_KEY`) y se emite un `console.warn` una sola vez. El fallback es **deliberado**: todos los `*_hash` ya almacenados se calcularon así, y exigir la variable dejaría a los usuarios existentes sin poder iniciar sesión. Definirla en una instalación en uso requiere recalcular antes esos hashes en la base de datos. |

## Archivos de ejemplo

- [`Docs/env_doc/.env.secret.example`](.env.secret.example)
- [`Docs/env_doc/.env.config.example`](.env.config.example)

## Sistema de cifrado (vault)

Ver [`Docs/env_doc/vault.md`](vault.md) para la documentación completa del vault.
