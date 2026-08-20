# Ravage — Documentation Index

> **Note on the root `README.md`.** The repository's top-level `README.md` describes an older version of the app (bcrypt, RSA-2048 key exchange, a RAM/disk LFU cache, etc.) and has drifted significantly from the current implementation. The documents below were written by reading and verifying the actual current source code, and each one calls out the specific places where the old README (or an older internal doc) no longer matches reality. Treat this `Docs/` tree — not the root README — as the source of truth for how the app works today.

## Start here

| Doc | What it covers |
|---|---|
| [architecture/OVERVIEW.md](./architecture/OVERVIEW.md) | Product framing, process model (Electron main/renderer), startup sequence, layered architecture diagram, full directory map |
| [architecture/BUILD_AND_ENVIRONMENT.md](./architecture/BUILD_AND_ENVIRONMENT.md) | `package.json` scripts, dependencies, preload bundling (esbuild), environment variables & the encrypted vault, running/building/testing |

## Backend

| Doc | What it covers |
|---|---|
| [backend/DATA_LAYER.md](./backend/DATA_LAYER.md) | MongoDB connection, all Mongoose models & their encrypted fields, all repositories, and the local SQLite (`better-sqlite3`) database |
| [backend/CRYPTO_SECURITY.md](./backend/CRYPTO_SECURITY.md) | Password hashing (Argon2id), at-rest encryption, X25519 E2EE key exchange & Double Ratchet, the message scanner, crypto/scanner worker threads |
| [backend/SESSION_AUTH.md](./backend/SESSION_AUTH.md) | Registration, email verification, trusted-device auto-login, manual login, JWT issuance, rate limiting, logout |
| [backend/MESSAGING.md](./backend/MESSAGING.md) | Mailbox/push notifications (Change Streams + Socket.IO), transactional email, local encrypted file storage, profile/validation logic, URL previews |
| [backend/IPC_AND_SERVERS.md](./backend/IPC_AND_SERVERS.md) | Every IPC channel registered under `backend/ipc/`, the local dev server vs. the Railway production server |
| [backend/CACHE_SYSTEM.md](./backend/CACHE_SYSTEM.md) | The current (SQLite + TTL-based) cache layer — supersedes the old LFU/disk-minification design described in the root README |

## Frontend

| Doc | What it covers |
|---|---|
| [frontend/PRELOAD.md](./frontend/PRELOAD.md) | Every `preload/*.cjs` module, what each exposes on `window`, the esbuild bundling step, and modules missing from the older Spanish `Docs/PRELOAD.md` |
| [frontend/FRONTEND.md](./frontend/FRONTEND.md) | The renderer app shell, all `frontend/home/ui/*.js` modules, styles, login/register screen, notifications, vendored libs (marked, DOMPurify) |

## Pre-existing docs (Spanish, mostly still accurate)

These were written earlier and were used as verified source material for the English docs above; kept here for reference and historical detail the new docs summarize:

- [Services/seguridad/LOGIN_SESION.md](./Services/seguridad/LOGIN_SESION.md)
- [Services/seguridad/HASHING_CONTRASENAS.md](./Services/seguridad/HASHING_CONTRASENAS.md)
- [Services/seguridad/DISPOSITIVOS_SEGURIDAD.md](./Services/seguridad/DISPOSITIVOS_SEGURIDAD.md)
- [Services/seguridad/SOCKETIO_AUTH.md](./Services/seguridad/SOCKETIO_AUTH.md)
- [Services/seguridad/ESCANERES_MENSAJES.md](./Services/seguridad/ESCANERES_MENSAJES.md)
- [Services/NOTIFICACIONES.md](./Services/NOTIFICACIONES.md)
- [Services/CLAVES_SISTEMA.md](./Services/CLAVES_SISTEMA.md)
- [Services/SERVIDORES.md](./Services/SERVIDORES.md)
- [PRELOAD.md](./PRELOAD.md) *(superseded by `frontend/PRELOAD.md` above, kept for history)*
- [env_doc/env.md](./env_doc/env.md), [env_doc/vault.md](./env_doc/vault.md)

## Biggest gaps found between the old root `README.md` and the current app

- **Password hashing**: Argon2id, not bcrypt.
- **E2EE key exchange**: X25519 ECDH + HKDF (Double Ratchet), not RSA-2048/OAEP.
- **Cache system**: rewritten around embedded SQLite with TTL/size eviction and fixed limits; the old RAM/disk LFU design is gone, and the adaptive-strategy selector that went with it (`backend/utils/systemInfo.js`) has been deleted from the codebase — it had no callers.
- **Secrets storage**: no longer a plaintext root `.env` — an OS-native encrypted vault (`backend/utils/env_vault.js`, Electron `safeStorage`) now holds secrets.
- **New subsystems not in the README at all**: worker-thread pools for crypto/content scanning, the message/URL security scanner (there is no file-content scanner), a multi-level decrypt-failure recovery cascade.

A full engineering-quality review (bugs, security issues, dead code) is intentionally kept out of this `Docs/` tree — see `/home/paraguayo33/Documentos/depuracion-ravage/` for that (Spanish, for internal use).
