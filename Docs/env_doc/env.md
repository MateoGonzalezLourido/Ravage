# Variables de Entorno

Hay dos archivos `.env` necesarios para arrancar la app:

- `.env.secret` — URI de MongoDB, API keys, claves de cifrado y secretos de autenticación.
- `.env.config` — Configuración interna de la app (no expuesta al usuario).

Ambos se colocan en `env/` antes del primer arranque. El vault los cifra automáticamente y los elimina del disco; a partir de ese momento las variables se leen desde el baúl cifrado.

## Archivos de ejemplo

- [`Docs/env_doc/.env.secret.example`](.env.secret.example)
- [`Docs/env_doc/.env.config.example`](.env.config.example)

## Sistema de cifrado (vault)

Ver [`Docs/env_doc/vault.md`](vault.md) para la documentación completa del vault.
