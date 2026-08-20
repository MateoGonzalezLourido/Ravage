<div align="center">

# 🔒 RAVAGE

### Encrypted messaging and file transfer app

[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

</div>

> [!NOTE]
> Full technical documentation (architecture, encryption, cache, IPC, frontend, etc.) lives in [`Docs/`](./Docs/README.md), not in this README. Start at [`Docs/README.md`](./Docs/README.md).

Ravage is a desktop messaging app with end-to-end encryption (X25519 + Double Ratchet + AES-256-GCM), designed as a private, self-hosted alternative to commercial messaging apps: each instance runs on your own infrastructure (your server, your MongoDB database).

It isn't meant to compete with WhatsApp/Telegram/Signal or to handle large scale: it's for small to medium groups who want to communicate privately without depending on third parties. It doesn't include voice or video calls — only messaging and encrypted file transfer.

## Requirements

| Requirement | Minimum version |
|---|---|
| **Node.js** | 18+ |
| **npm** | 9+ |
| **MongoDB** | Atlas (cloud) or self-hosted instance |

## Installation

```bash
git clone https://github.com/MateoGonzalezLourido/Ravage.git
cd Ravage
npm install
```

Set up your environment variables following [`Docs/architecture/BUILD_AND_ENVIRONMENT.md`](./Docs/architecture/BUILD_AND_ENVIRONMENT.md) and [`Docs/env_doc/`](./Docs/env_doc/).

## Running

```bash
npm start              # Desktop app (Electron)
npm run start-railway  # Production server mode (Railway)
npm run test           # Test suite (Vitest)
```

## Documentation

All technical documentation lives in [`Docs/`](./Docs/README.md): architecture, encryption, data layer, session/auth, messaging, IPC/servers, cache, frontend, and preload.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

<div align="center">

**Developed by [Mateo González Lourido](https://github.com/MateoGonzalezLourido)**

</div>
