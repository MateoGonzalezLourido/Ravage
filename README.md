<div align="center">

# 🔒 RAVAGE

### Aplicación de mensajería cifrada y transferencia de archivos

[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

</div>

> [!NOTE]
> La documentación técnica completa (arquitectura, cifrado, caché, IPC, frontend, etc.) vive en [`Docs/`](./Docs/README.md), no en este README. Empieza por [`Docs/README.md`](./Docs/README.md).

Ravage es una app de mensajería de escritorio con cifrado extremo a extremo (X25519 + Double Ratchet + AES-256-GCM), pensada como alternativa privada y autoalojada a las apps de mensajería comerciales: cada instancia corre sobre tu propia infraestructura (tu servidor, tu base de datos MongoDB).

No está pensada para competir con WhatsApp/Telegram/Signal ni para gran escala: es para grupos pequeños o medianos que quieren comunicarse de forma privada sin depender de terceros. No incluye llamadas ni videollamadas, solo mensajería y transferencia de archivos cifrada.

## Requisitos

| Requisito | Versión mínima |
|---|---|
| **Node.js** | 18+ |
| **npm** | 9+ |
| **MongoDB** | Atlas (cloud) o instancia propia |

## Instalación

```bash
git clone https://github.com/MateoGonzalezLourido/Ravage.git
cd Ravage
npm install
```

Configura las variables de entorno siguiendo [`Docs/architecture/BUILD_AND_ENVIRONMENT.md`](./Docs/architecture/BUILD_AND_ENVIRONMENT.md) y [`Docs/env_doc/`](./Docs/env_doc/).

## Ejecución

```bash
npm start              # App de escritorio (Electron)
npm run start-railway  # Servidor en modo producción (Railway)
npm run test           # Suite de tests (Vitest)
```

## Documentación

Toda la documentación técnica está en [`Docs/`](./Docs/README.md): arquitectura, cifrado, capa de datos, sesión/auth, mensajería, IPC/servidores, caché, frontend y preload.

---

<div align="center">

**Desarrollado por [Mateo González Lourido](https://github.com/MateoGonzalezLourido)**

</div>
