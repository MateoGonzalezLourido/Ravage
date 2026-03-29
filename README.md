<div align="center">

# 🔒 RAVAGE

### Aplicación de mensajería cifrada y transferencia de archivos

[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Ravage** es una aplicación de escritorio construida con Electron que implementa un **sistema de mensajería con cifrado extremo a extremo (E2EE)** basado en un protocolo de ratchet simétrico, transferencia segura de archivos cifrados con AES-256-GCM en streaming, y un sistema de caché adaptativo multinivel que ajusta su estrategia según los recursos del sistema.

[Instalación](#-instalación) · [Arquitectura](#-arquitectura) · [Cifrado](#-sistema-de-cifrado-en-profundidad) · [Servidor](#-modos-de-servidor) · [Caché](#-sistema-de-caché-multinivel)

</div>

---

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Stack Tecnológico](#-stack-tecnológico)
- [Instalación](#-instalación)
- [Configuración](#-configuración-de-variables-de-entorno)
- [Ejecución](#-ejecución)
- [Modos de Servidor](#-modos-de-servidor)
- [Arquitectura](#-arquitectura)
- [Estructura de Archivos](#-estructura-de-archivos)
- [Sistema de Cifrado en Profundidad](#-sistema-de-cifrado-en-profundidad)
- [Sistema de Caché Multinivel](#-sistema-de-caché-multinivel)
- [Sistema de Notificaciones en Tiempo Real](#-sistema-de-notificaciones-en-tiempo-real)
- [Monitorización Estructurada](#-monitorización-estructurada)
- [Seguridad Adicional](#-seguridad-adicional)

---

## ✨ Características Principales

| Categoría | Detalle |
|---|---|
| **Cifrado E2EE** | Protocolo de Sender Key Ratchet con derivación HMAC-SHA256 y cifrado AES-256-GCM para mensajes y archivos |
| **Distribución de claves** | RSA-2048 con OAEP padding para intercambio seguro del ChainKey entre participantes |
| **Cifrado de archivos en streaming** | Pipeline `ReadStream → CipherStream → GridFS` sin cargar el archivo completo en memoria |
| **Caché adaptativo** | Sistema multinivel RAM/Disco con detección de recursos del sistema (CPU, RAM, disco) y ajuste automático de estrategia |
| **Persistencia de caché** | Minificación de objetos y serialización periódica cifrada a disco para recuperación rápida entre sesiones |
| **Notificaciones en tiempo real** | MongoDB Change Streams + Socket.IO para push instantáneo de mensajes y eventos |
| **Servidor dual** | Modo local (HTTP/HTTPS) para desarrollo y modo Railway (producción) con puerto dinámico y health checks |
| **Autenticación multifactor** | Login con verificación por código de 6 dígitos enviado por email (Brevo API), JWT con rotación, dispositivos de confianza |
| **Datos at-rest cifrados** | Toda la información sensible en MongoDB se almacena cifrada con AES-256-GCM (campos `EncryptedData`) |
| **Almacenamiento local cifrado** | Archivos de sesión, identidad y caché cifrados en disco con AES-256-GCM usando clave de sistema |
| **Aislamiento de procesos** | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` — comunicación solo vía IPC tipado |
| **Validación exhaustiva** | Capa de validación server-side para correos, apodos, contraseñas, IDs, códigos y nombres de archivo |
| **Logging Estructurado** | Logs de alto rendimiento en JSON con Pino para monitorizar eventos E2EE, DB y Auth |

---

## 🛠 Stack Tecnológico

```
Frontend    → Electron 41 · HTML5 · CSS3 · JavaScript ES Modules
Backend     → Node.js 18+ · Express 5 · Mongoose 9
Base de datos → MongoDB Atlas (TLS) · GridFS (archivos)
Tiempo real  → Socket.IO 4.x · MongoDB Change Streams
Criptografía → AES-256-GCM · RSA-2048 (OAEP) · HMAC-SHA256 · bcrypt (14 rondas) · SHA-256
Auth         → JSON Web Tokens · Brevo API (email transaccional)
Sistema      → systeminformation · node-machine-id
Monitor      → pino · pino-pretty
```

---

## 📦 Instalación

### Requisitos previos

| Requisito | Versión mínima |
|---|---|
| **Node.js** | 18+ (necesario para `fetch` nativo y ESM) |
| **npm** | 9+ |
| **Git** | Cualquiera |
| **MongoDB** | Atlas (cloud) o instancia local |

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/MateoGonzalezLourido/Ravage.git
cd Ravage

# 2. Instalar dependencias
npm install
```

> [!NOTE]
> Electron se instala como devDependency. En conexiones lentas puede tardar unos minutos porque descarga los binarios del motor Chromium.

---

## ⚙ Configuración de Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# ── Base de datos ──
URI_MONGODB=mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/<db>?appName=RAVAGE

# ── Autenticación ──
SECRET_KEY_JWT=<clave_hex_64_chars>           # Firma de JSON Web Tokens
SECRET_KEY_COKKIE=<clave_hex_64_chars>        # Cifrado de archivos locales (AES-256)
SALTOS_ENCRIPTAR_CONTRASENA=14                # Rondas de bcrypt

# ── Cifrado interno ──
INTERNAL_ENCRYPTION_KEY=<clave_hex_64_chars>  # Cifrado at-rest de datos en MongoDB

# ── Servicio de email (Brevo) ──
BREVO_API_KEY=<tu_api_key>
BREVO_SENDER_EMAIL=<tu_email_verificado>
```

Para generar claves hexadecimales seguras de 32 bytes (256 bits):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> [!CAUTION]
> **Nunca subas el archivo `.env` a un repositorio público.** Contiene claves criptográficas y credenciales de base de datos. El `.gitignore` del proyecto ya lo excluye.

---

## 🚀 Ejecución

### Modo escritorio (Electron)

```bash
npm start
# Equivale a: electron .
```

Al arrancar, la aplicación ejecuta la siguiente secuencia:

1. **Inicia el servidor Express** (localhost:3000) con Socket.IO
2. **Conecta a MongoDB Atlas** con TLS habilitado
3. **Intenta auto-login** leyendo el archivo de sesión cifrado local
4. **Crea la ventana principal** de Electron con sandbox activado

### Modo servidor Railway (producción)

```bash
npm run start-railway
# Equivale a: node backend/servidores/serverRailway.js
```

> [!TIP]
> Ver la sección [Modos de Servidor](#-modos-de-servidor) para una explicación detallada de cada modo.

---

## 🌐 Modos de Servidor

La aplicación soporta diferentes configuraciones de servidor según el entorno de ejecución. Los archivos de configuración se encuentran en `backend/servidores/`.

### Servidor Local — HTTP (por defecto)

**Archivo:** `serverLocalHost.js`

```
Cliente Electron ←→ http://localhost:3000 ←→ MongoDB Atlas
                         ↕
                    Socket.IO (ws://)
```

- Puerto fijo: `3000`
- CORS restringido a `localhost:3000`, `localhost:8080` y `file://`
- Ideal para **desarrollo y testing**
- Arranque automático al lanzar Electron (`npm start`)

### Servidor Local — HTTPS (plantilla incluida)

El archivo `serverLocalHost.js` incluye una **plantilla comentada** para activar HTTPS con certificados propios:

```bash
# Generar certificados autofirmados para desarrollo
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

Para activarlo, descomenta la sección HTTPS en `serverLocalHost.js` y apunta a tus archivos `.pem`. Todos los archivos de certificados (`*.pem`, `*.key`, `*.crt`) están excluidos por `.gitignore`.

### Servidor Railway — Producción

**Archivo:** `serverRailway.js`

```
Clientes ←→ https://<tu-app>.up.railway.app ←→ MongoDB Atlas
                        ↕
                   Socket.IO (wss://)
```

- Puerto dinámico vía `process.env.PORT` (Railway lo inyecta automáticamente)
- Escucha en `0.0.0.0` para aceptar conexiones externas
- CORS configurable vía `process.env.CLIENT_URL`
- **Health check endpoint** en `/` — Railway lo usa para verificar que el servicio está vivo
- Transportes Socket.IO: `websocket` + `polling` (fallback para redes restrictivas)
- Ejecución independiente de Electron: conecta a MongoDB por su cuenta

---

## 🏗 Arquitectura

### Diagrama de alto nivel

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ELECTRON (Proceso Main)                      │
│                                                                     │
│  main.js                                                            │
│  ├── Servidor Express + Socket.IO (serverLocalHost / serverRailway) │
│  ├── MongoDB (Mongoose TLS)                                         │
│  ├── Auto-login / Sesión                                            │
│  └── IPC Handlers (session, chat, social, validadores, cache)       │
│                                                                     │
│  preload.cjs (contextBridge)                                        │
│  ├── sesion_usuario    → Login, registro, verificación              │
│  ├── cuenta_usuario    → Datos de perfil, cambios de cuenta         │
│  ├── social_usuario    → Contactos, bloqueados, búsqueda            │
│  ├── chats             → Mensajería, archivos, E2EE                 │
│  ├── buzonAPI          → Notificaciones push en tiempo real          │
│  ├── validadores       → Validación de inputs                       │
│  ├── cache_persistente → Caché chats/usuarios (RAM + disco)         │
│  └── ajustes_app       → Configuración de la app                    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     ELECTRON (Proceso Renderer)                      │
│                                                                     │
│  frontend/sesion-log/  → Pantallas de login y registro              │
│  frontend/home/        → Interfaz principal (chats, ajustes)        │
│  frontend/soporte/     → Página de soporte                          │
│                                                                     │
│  Comunicación: window.sesion_usuario.LOGIN_USUARIO(...)             │
│  (Solo APIs expuestas por contextBridge — sin acceso a Node.js)     │
└─────────────────────────────────────────────────────────────────────┘
```

### Patrón de capas

```
Renderer (UI)  →  preload.cjs (Bridge)  →  IPC Handlers  →  Repositories  →  Mongoose Models  →  MongoDB
                                                ↓
                                           Services
                                      (crypto, sesión, buzón,
                                       archivos, validadores)
                                                ↓
                                        STORAGE / CACHE
                                   (variables de sesión en
                                    memoria + caché multinivel)
```

| Capa | Responsabilidad |
|---|---|
| **Renderer** | Interfaz de usuario. Sin acceso a Node.js ni al backend |
| **Preload** | Puente `contextBridge`. Filtra y expone solo las APIs necesarias |
| **IPC Handlers** | Orquestan la lógica de cada dominio (sesión, chat, social, caché) |
| **Services** | Lógica de negocio: cifrado, sesión, buzón, archivos, validación |
| **Repositories** | Acceso a datos. Encapsulación de queries a Mongoose |
| **Models** | Esquemas Mongoose con tipos `EncryptedData` para cifrado at-rest |
| **STORAGE** | Variables de sesión en memoria y sistema de caché multinivel |

---

## 📂 Estructura de Archivos

```
Ravage/
├── main.js                          # Entry point. Inicia servidor, DB, ventana Electron
├── preload.cjs                      # contextBridge — APIs expuestas al renderer
├── package.json                     # Dependencias y scripts
├── .env                             # Variables de entorno (no versionado)
│
├── backend/
│   ├── db/
│   │   └── mongo.js                 # Conexión a MongoDB Atlas con TLS
│   │
│   ├── models/
│   │   ├── User.js                  # Esquema usuario (campos cifrados: apodo, correo, idamigo)
│   │   ├── Chat.js                  # Esquema chat (ratchet_keys para E2EE)
│   │   ├── Message.js               # Esquema mensaje (encriptado E2EE + copia sistema)
│   │   ├── Buzon.js                 # Esquema buzón (notificaciones cifradas)
│   │   └── Security.js              # Códigos de validación, tokens JWT, dispositivos bloqueados
│   │
│   ├── repositories/
│   │   ├── UserRepository.js        # CRUD de usuarios con descifrado automático
│   │   ├── ChatRepository.js        # Gestión de chats, rotación de claves ratchet
│   │   ├── MessageRepository.js     # Envío/descarga de mensajes E2EE + archivos GridFS
│   │   ├── BuzonRepository.js       # Inserción de entradas en el buzón
│   │   └── SecurityRepository.js    # Tokens JWT, códigos de verificación
│   │
│   ├── services/
│   │   ├── cryptoService.js         # Core criptográfico: AES-256-GCM, RSA, Ratchet, hashing
│   │   ├── messageCryptoService.js  # Descifrado de listas de mensajes con ratchet forward
│   │   ├── sesionUsuario.js         # Login, registro, auto-login, verificación por email
│   │   ├── controladorArchivos.js   # Lectura/escritura cifrada de archivos locales
│   │   ├── buzon.js                 # MongoDB Change Streams para notificaciones push
│   │   ├── validadores.js           # Validación de correo, apodo, contraseña, etc.
│   │   ├── CreadorTokens.js         # Generación y validación de JWT
│   │   └── MENSAJERIA/
│   │       ├── Servicio_mensajeria_correo.js  # Envío de emails vía Brevo API
│   │       └── Estructuras_correos.js         # Templates HTML de emails
│   │
│   ├── ipc/
│   │   ├── session_ipc.js           # Handlers IPC de sesión (login, registro, logout)
│   │   ├── chat_ipc.js              # Handlers IPC de chats (enviar, descargar, crear)
│   │   ├── social_ipc.js            # Handlers IPC social (contactos, bloqueos)
│   │   ├── validadores_ipc.js       # Handlers IPC de validación
│   │   ├── cache_persistent_ipc.js  # Handlers IPC de caché persistente
│   │   ├── cache_img_extension_ipc.js    # Handlers IPC caché de iconos
│   │   └── cache_archivos_descargados_ipc.js  # Handlers IPC caché de descargas
│   │
│   ├── servidores/
│   │   ├── serverLocalHost.js       # Servidor HTTP/HTTPS para desarrollo local
│   │   └── serverRailway.js         # Servidor de producción para Railway
│   │
│   ├── STORAGE/
│   │   ├── Variables_sesion.js      # Variables de sesión en memoria (getters/setters)
│   │   ├── ajustes_defecto.js       # Configuración por defecto de la app
│   │   └── CACHE/
│   │       ├── _cache_chats.js      # Caché de chats (RAM + disco, LFU + protección temporal)
│   │       ├── _cache_usuarios.js   # Caché de usuarios (RAM + disco, LFU + protección temporal)
│   │       ├── _cache_img_extensiones.js  # Caché de iconos de extensiones de archivo
│   │       └── _cache_archivos_descargados.js  # Caché de historial de descargas
│   │
│   └── utils/
│       ├── libs.js                  # Hub centralizado de imports (Node, Electron, npm)
│       ├── systemInfo.js            # Detección de RAM/Disco y recomendación de estrategia de caché
│       └── conversores.js           # Utilidades de conversión de tipos
│
└── frontend/
    ├── sesion-log/                  # UI de login, registro y verificación
    │   ├── sesion.html
    │   ├── log.js
    │   └── style.css
    │
    ├── home/                        # UI principal
    │   ├── home.html                # Layout principal de la app
    │   ├── renderer.js              # Lógica principal del renderer
    │   ├── styles/                  # Hojas de estilo
    │   └── ui/
    │       ├── chat.js              # Renderizado de mensajes y chat
    │       ├── ajustes.js           # Panel de ajustes
    │       ├── añadir_chats_usuarios.js           # Crear chats, buscar usuarios
    │       ├── historial_archivos_descargados.js   # UI del historial de descargas
    │       └── url_icono_extensiones_archivos.js   # Iconos dinámicos por extensión
    │
    ├── soporte/                     # Página de soporte
    ├── notificaciones/              # Sistema de notificaciones
    └── recursos/                    # Assets estáticos (imágenes, iconos)
```

---

## 🔐 Sistema de Cifrado en Profundidad

Ravage implementa un sistema de cifrado en múltiples capas que protege los datos tanto en tránsito como en reposo. A continuación se describe cada capa en detalle técnico.

### Visión general de las capas de cifrado

```
┌─────────────────────────────────────────────────────────┐
│  CAPA 5: Transporte                                     │
│  TLS (MongoDB Atlas) + WSS (Socket.IO en producción)    │
├─────────────────────────────────────────────────────────┤
│  CAPA 4: Cifrado E2EE de mensajes                       │
│  AES-256-GCM con clave derivada por Sender Key Ratchet  │
├─────────────────────────────────────────────────────────┤
│  CAPA 3: Cifrado de archivos en streaming               │
│  AES-256-GCM en pipeline (ReadStream → Cipher → GridFS) │
├─────────────────────────────────────────────────────────┤
│  CAPA 2: Cifrado at-rest en MongoDB                     │
│  AES-256-GCM con INTERNAL_ENCRYPTION_KEY                │
├─────────────────────────────────────────────────────────┤
│  CAPA 1: Cifrado de almacenamiento local                │
│  AES-256-GCM con SECRET_KEY_COKKIE                      │
├─────────────────────────────────────────────────────────┤
│  CAPA 0: Hashing de credenciales                        │
│  bcrypt (14 rondas) para contraseñas                    │
│  SHA-256 para búsquedas deterministas                   │
└─────────────────────────────────────────────────────────┘
```

---

### Capa 0 — Hashing de credenciales

#### Contraseñas: bcrypt

```
contraseña_usuario  →  bcrypt(contraseña, 14 rondas)  →  hash almacenado
```

- **Algoritmo:** bcrypt con **14 rondas** de salt (`SALTOS_ENCRIPTAR_CONTRASENA=14`)
- Cada ronda duplica el coste computacional, haciendo ataques de fuerza bruta prohibitivos
- El salt se genera automáticamente y se incorpora en el hash resultante
- La verificación usa `bcrypt.compare()` para timing-safe comparison

#### Búsquedas deterministas: SHA-256

Para poder realizar búsquedas en la base de datos sobre campos cifrados (como el correo) sin exponerlos, se almacena un hash SHA-256 junto al dato cifrado:

```
correo_usuario  →  SHA-256(correo)  →  correo_hash (indexado en MongoDB)
```

Esto permite buscar por `correo_hash` sin necesidad de descifrar todos los registros. El campo `correo` en sí se almacena cifrado con AES-256-GCM (Capa 2).

---

### Capa 1 — Cifrado de almacenamiento local

Todos los archivos locales sensibles (sesión, identidad, caché, ajustes) se cifran antes de escribirlos a disco.

**Archivo:** `controladorArchivos.js`

```
Datos  →  JSON.stringify  →  AES-256-GCM(SECRET_KEY_COKKIE, IV_aleatorio)  →  {iv, tag, data}  →  archivo.json
```

| Componente | Detalle |
|---|---|
| **Algoritmo** | AES-256-GCM (autenticado) |
| **Clave** | `SECRET_KEY_COKKIE` (256 bits, del `.env`) |
| **IV** | 12 bytes generados con `crypto.randomBytes()` por cada escritura |
| **Authentication Tag** | 128 bits, verificado en cada lectura |
| **Formato en disco** | `{ iv: hex, tag: hex, data: hex }` |

Archivos protegidos en la carpeta `<appData>/.APP_DATA/`:

| Archivo | Contenido |
|---|---|
| `sesionfile.json` | Correo + JWT de sesión |
| `identity.json` | Par de claves RSA (pública + privada) del usuario |
| `auto_login.json` | Token para omitir verificación futura |
| `dp_confi.json` | Token de dispositivo de confianza |
| `ajustes_app.json` | Configuración de la app (rutas de descarga, límites de caché) |
| `cache_archivos.json` | Historial de archivos descargados |
| `cache_chats_frec.json` | Chats frecuentes minificados |
| `cache_users_frec.json` | Usuarios frecuentes minificados |

Si el descifrado falla (clave incorrecta o archivo corrupto), el archivo se **elimina automáticamente** para evitar errores persistentes en cascada.

---

### Capa 2 — Cifrado at-rest en MongoDB

Todos los datos sensibles almacenados en MongoDB usan un esquema reutilizable `EncryptedData`:

```javascript
// Esquema que se repite en User, Chat, Message, Buzon, Security
const EncryptedDataSchema = {
    data: String,  // Contenido cifrado (hex)
    iv:   String,  // Vector de inicialización (hex)
    tag:  String   // Authentication tag (hex)
}
```

**Archivo:** `cryptoService.js` → funciones `encriptarDatosSistema()` / `desencriptarDatosSistema()`

| Componente | Detalle |
|---|---|
| **Algoritmo** | AES-256-GCM |
| **Clave** | `INTERNAL_ENCRYPTION_KEY` (256 bits, del `.env`) |
| **IV** | 12 bytes, `crypto.randomBytes(12)`, único por campo |

Campos cifrados en cada modelo:

| Modelo | Campos cifrados |
|---|---|
| **User** | `apodo`, `correo`, `idamigo`, cada contacto (`apodo`), cada chat (`ultimomensaje`, `nombre_bloqueo`) |
| **Message** | `contenido[].asunto`, `contenido[].archivos[].nombre` |
| **Chat** | `nombre` |
| **Buzon** | `entrada[].data` |
| **Security** | `correo`, `id_dp`, `data` (en ValidationCode, Tokens, etc.) |

---

### Capa 3 — Cifrado de archivos en streaming

Los archivos se cifran **en streaming** durante la subida a GridFS, sin cargar el archivo completo en memoria:

```
fs.createReadStream(archivo)
   │
   ▼
CipherStream (AES-256-GCM)    ← MessageKey derivada del Ratchet
   │                            ← IV: crypto.randomBytes(12)
   ▼
GridFS.openUploadStream()      → MongoDB (bucket "ArchivosChats")
   │
   ▼
Auth Tag almacenado en el mensaje
```

**La descarga invierte el pipeline:**

```
GridFS.openDownloadStream(id)
   │
   ▼
DecipherStream (AES-256-GCM)   ← MessageKey re-derivada del Ratchet
   │                             ← IV y Tag del registro del mensaje
   ▼
fs.createWriteStream(destino)
```

| Aspecto | Detalle |
|---|---|
| **Clave** | `MessageKey` — la misma que cifra el contenido del mensaje (derivada del Ratchet) |
| **Ventaja** | Archivos de cualquier tamaño se procesan en chunks, sin pico de memoria |
| **Nombre protegido** | El nombre real del archivo se cifra con `encriptarDatosSistema()` y el nombre en GridFS es solo su ObjectId |
| **Duplicados** | Si ya existe un archivo con el mismo nombre en la carpeta de descargas, se renombra automáticamente: `archivo (1).txt`, `archivo (2).txt`, etc. |

---

### Capa 4 — Cifrado E2EE con Sender Key Ratchet

Esta es la capa más compleja y la que protege la comunicación entre usuarios de punta a punta.

#### 4.1 Generación de identidad

Cuando un usuario se registra, se genera un **par de claves RSA-2048**:

```
generarLlavesRSA()
   ↓
publicKey  → Se sube a MongoDB (campo User.publicKey)
privateKey → Se guarda cifrada localmente (identity.json vía Capa 1)
```

- **Algoritmo:** RSA-2048 con codificación SPKI (pública) y PKCS#8 (privada) en formato PEM
- La clave privada **nunca sale del dispositivo** del usuario
- Si el usuario inicia sesión en otro dispositivo, puede regenerar su identidad (con la consecuencia de perder lectura de mensajes antiguos)

#### 4.2 Creación de un chat — Distribución de ChainKeys

Al crear un nuevo chat, se genera un **ChainKey simétrico único** para cada emisor y se distribuye a todos los participantes usando RSA:

```
Para cada emisor E en el chat:
    chainKey = crypto.randomBytes(32)       # 256 bits de entropía

    Para cada receptor R en el chat (incluido E):
        clave_envuelta = RSA_OAEP_Encrypt(chainKey, R.publicKey)
        Almacenar en chat.ratchet_keys: {
            emisor_id:      E._id,
            receptor_id:    R._id,
            clave_envuelta: clave_envuelta,  // ChainKey cifrada con RSA pública
            counter:        0
        }
```

| Componente | Detalle |
|---|---|
| **Envoltura** | `RSA-OAEP` con hash SHA-1 (implementado con `crypto.publicEncrypt`) |
| **Por qué RSA** | Permite que el emisor cifre el ChainKey para cada receptor sin necesidad de estar online simultáneamente |

#### 4.3 Envío de un mensaje — Derivación del MessageKey

```
 ChainKey (CK_n)
      │
      ├──── HMAC-SHA256(CK_n, 0x01) ──→  MessageKey  ──→  AES-256-GCM(mensaje)
      │
      └──── HMAC-SHA256(CK_n, 0x02) ──→  CK_{n+1}   ──→  Reemplaza CK_n
```

1. El emisor lee su `clave_envuelta` propia y la descifra con su clave privada RSA
2. Aplica **HMAC-SHA256** con la constante `0x01` para derivar el `MessageKey`
3. Aplica **HMAC-SHA256** con la constante `0x02` para derivar el siguiente `ChainKey`
4. Cifra el payload completo del mensaje (asunto + archivos + emisor + fecha) con AES-256-GCM usando el `MessageKey`
5. Almacena el `iteration` counter en `ratchet_info` del mensaje
6. Re-cifra el nuevo ChainKey con su propia clave pública RSA y actualiza en la DB

#### 4.4 Recepción de un mensaje — Ratchet Forward

El receptor:

1. Lee la `clave_envuelta` que el emisor cifró para él y la descifra con su clave privada RSA
2. Si su `counter` local es menor que la `iteration` del mensaje, avanza el ratchet:
   ```
   while (counter < m.ratchet_info.iteration):
       CK = HMAC-SHA256(CK, 0x02)
       counter++
   ```
3. Deriva el `MessageKey` con `HMAC-SHA256(CK, 0x01)` y descifra el mensaje
4. Avanza una posición más para el siguiente mensaje
5. **Persiste** el nuevo estado del ratchet en la DB

#### 4.5 Rotación automática de claves

Cuando el `counter` de un emisor supera **100 iteraciones**, se dispara automáticamente una rotación completa:

- Se genera un nuevo `ChainKey` aleatorio
- Se re-distribuye a todos los participantes usando RSA
- El `counter` se reinicia a 0

Esto limita la ventana de exposición: incluso si un atacante comprometiera un `ChainKey`, solo podría leer como máximo 100 mensajes futuros.

#### 4.6 Recuperación ante fallos

El sistema implementa una **cascada de recuperación** de 3 niveles:

```
Intento 1: Descifrar con la clave actual
    ↓ (fallo)
Intento 2: Rotar claves del chat y reintentar
    ↓ (fallo)
Intento 3: Regenerar identidad completa (NUCLEAR) y rotar
    ↓ (fallo)
Mostrar "[Error al descifrar: posible clave de dispositivo obsoleta]"
```

#### 4.7 Diagrama completo del flujo E2EE

```
  EMISOR                                              RECEPTOR
    │                                                     │
    │  1. RSA_Decrypt(clave_envuelta_propia)               │
    │     → ChainKey_n                                     │
    │                                                     │
    │  2. MessageKey = HMAC(CK_n, 0x01)                   │
    │     NextCK    = HMAC(CK_n, 0x02)                    │
    │                                                     │
    │  3. E2EE_payload = AES-GCM(mensaje, MessageKey)     │
    │     Archivos: ReadStream → CipherStream(MK) → GridFS│
    │                                                     │
    │  4. RSA_Encrypt(NextCK, self.publicKey)              │
    │     → Actualizar ratchet_keys en DB                  │
    │                                                     │
    │  5. Guardar mensaje con ratchet_info.iteration = n   │
    │     Notificar vía Buzón + Socket.IO                  │
    │──────────────────────────────────────────────────────▶│
    │                                                     │
    │                  6. RSA_Decrypt(clave_envuelta_para_receptor)
    │                     → ChainKey_m                     │
    │                                                     │
    │                  7. Ratchet forward: m → n           │
    │                     CK = HMAC(CK, 0x02) (repetir)   │
    │                                                     │
    │                  8. MessageKey = HMAC(CK_n, 0x01)    │
    │                     Descifrar payload AES-GCM        │
    │                                                     │
    │                  9. Persistir nuevo estado ratchet    │
```

---

### Capa 5 — Seguridad en transporte

| Canal | Protección |
|---|---|
| **MongoDB Atlas** | TLS obligatorio (`tls: true` en la configuración de Mongoose) |
| **Socket.IO (producción)** | WSS cuando se despliega detrás de un proxy con TLS (Railway proporciona TLS automáticamente) |
| **Socket.IO (local)** | WS (sin cifrar), protegido por el hecho de que es `localhost` |
| **API Brevo** | HTTPS para envío de emails |

---

## 💾 Sistema de Caché Multinivel

Ravage implementa un sistema de caché inteligente que adapta su estrategia según los recursos disponibles del sistema.

### Detección de recursos

**Archivo:** `systemInfo.js`

Al iniciar, el sistema consulta RAM total y disco libre usando `systeminformation`:

| RAM del sistema | Estrategia recomendada | Tamaño de caché |
|---|---|---|
| ≥ 32 GB | RAM | 4096 MB |
| ≥ 16 GB | RAM | 2048 MB |
| ≥ 8 GB | RAM | 1024 MB |
| < 8 GB + disco > 50 GB | Disco | 2048 MB |
| < 8 GB + disco < 50 GB | RAM (mínima) | 256 MB |

### Estructura del caché

```
                    ┌─────────────────────────────┐
                    │   Map() — Caché en RAM       │
  CACHE HIT ───────│   (acceso < 1ms)              │
                    │   Limitada por recursos       │
                    └──────────┬──────────────────┘
                               │ miss
                               ▼
                    ┌─────────────────────────────┐
                    │  Disco — Caché persistente   │
  CACHE HIT ───────│  (archivo .json cifrado)      │
                    │  Datos minificados            │
                    └──────────┬──────────────────┘
                               │ miss
                               ▼
                    ┌─────────────────────────────┐
                    │  MongoDB Atlas — Fuente      │
  FETCH + CACHE ───│  (query remota + descifrado)  │
                    │  Resultado guardado en caché  │
                    └─────────────────────────────┘
```

### Política de evicción: LFU + Protección temporal

Cuando la caché excede su límite en MB, se aplica:

1. **Ordenación por frecuencia** (Least Frequently Used) — los elementos menos accedidos se evalúan primero
2. **Desempate por antigüedad** — entre elementos con la misma frecuencia, se evicta el que no se ha usado hace más tiempo
3. **Protección temporal** — los elementos accedidos en los últimos **5 minutos** están protegidos y se saltan en la evicción (a menos que sea necesario por falta total de espacio)

### Minificación para persistencia

Antes de serializar a disco, los objetos se **minifican** para reducir el tamaño del archivo JSON:

```javascript
// Objeto completo en RAM (~200 bytes)
{ _id: "abc", nombre: "Chat", usuarios: [...], _frequency: 5, _last_used: 1711700000000 }

// Objeto minificado en disco (~80 bytes)
{ i: "abc", n: "Chat", u: [...], f: 5, t: 1711700000000 }
```

### Persistencia diferida (Debounce)

La escritura a disco se ejecuta con un **debounce de 10-15 segundos** para evitar escrituras excesivas:

```
setChatEnCache() → _gestionar_persistencia_frecuentes() → setTimeout(10000ms) → saveCacheChatsFile()
```

### Tipos de caché

| Caché | Almacena | Persistencia | Configurable |
|---|---|---|---|
| **Chats** | Datos de chats con ratchet_keys | ✅ Disco (cifrado) | Límite RAM/Disco + forzar disco |
| **Usuarios** | Perfiles descifrados (apodo, publicKey) | ✅ Disco (cifrado) | Límite RAM/Disco + forzar disco |
| **Iconos de extensiones** | URLs de iconos SVG por extensión de archivo | ✅ En memoria | Límite de entradas |
| **Archivos descargados** | Historial de descargas (nombre, ruta, fecha) | ✅ Disco (cifrado) | Límite de entradas |

---

## 📡 Sistema de Notificaciones en Tiempo Real

### Arquitectura del Buzón

```
MongoDB (Colección "buzon")
        │
        ▼
  Change Stream (watch)  ─── filtra por userId ──→  Socket.IO room
        │                                               │
        ▼                                               ▼
  mainWindow.webContents.send()                  io.to(userId).emit()
        │                                               │
        ▼                                               ▼
  Renderer (frontend)                            Otros clientes (futuro)
```

- Usa **MongoDB Change Streams** con `fullDocument: "updateLookup"` para observar cambios en la colección `buzon`
- Filtra por usuario propio para no procesar notificaciones ajenas
- Cierre graceful: al cerrar la app, se ejecuta `detenerBuzon()` que cierra el Change Stream antes de desconectar MongoDB

---

## 📊 Monitorización y Testing

Para garantizar la fiabilidad y observabilidad de los procesos críticos (E2EE, Auth, DB), el sistema integra herramientas profesionales de registro y pruebas.

### Logging Estructurado (Pino)
- **Desarrollo:** Salida legible y coloreada con `pino-pretty`.
- **Producción:** Logs JSON estructurados listos para ser ingeridos por plataformas de monitorización (Grafana, Datadog).

### Tests Unitarios (Vitest)
Suite de pruebas exhaustivas para el núcleo de seguridad y validación:
- **Criptografía:** Verificación de AES-GCM, RSA, SHA-256 y protocolos de Ratchet.
- **Validadores:** Pruebas de seguridad para inputs, correos y prevención de inyección de rutas.

```bash
# Ejecutar la suite de pruebas
npm run test
```

---

## 🛡 Seguridad Adicional

### Aislamiento de procesos Electron

```javascript
// main.js — Configuración de la ventana
webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'),
    nodeIntegration: false,      // El renderer NO tiene acceso a Node.js
    contextIsolation: true,      // Contextos separados (previene prototype pollution)
    sandbox: true                // Sandboxing del proceso renderer
}
```

### Bloqueo de dispositivos

- Se identifica cada dispositivo con `node-machine-id` (ID de hardware único)
- Los dispositivos pueden ser **bloqueados** permanentemente para una cuenta
- En cada login y auto-login se verifica el blacklist

### Verificación de cuenta por email

```
Registro/Login → Código de 6 dígitos → Email vía Brevo API → Hash SHA-256 del código en MongoDB
                                                               ↓
                                                         5 intentos máximo
                                                         10 min de expiración (TTL index)
```

### Tokens JWT con rotación

| Token | Duración | Propósito |
|---|---|---|
| **Sesión** | 7 días | Mantener sesión iniciada |
| **Verificación de cuenta** | 90 minutos | Omitir verificación por código en logins futuros |
| **Dispositivo de confianza** | Permanente | Saltar verificación en dispositivos conocidos |

Los tokens se almacenan como **hash SHA-256** en MongoDB y en formato JWT cifrado en disco local. En logout, se eliminan tanto del servidor como del cliente.

### Cooldowns de cambios de perfil

| Dato | Cooldown |
|---|---|
| Apodo | 1 hora desde la creación |
| Correo | 72 horas desde la creación |
| Contraseña | 24 horas desde la creación |

### Instancia única

```javascript
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) app.quit();
```

Solo se permite **una instancia** de la aplicación por máquina. Si el usuario intenta abrir otra, la ventana existente se enfoca.

---

<div align="center">

**Desarrollado por [Mateo González Lourido](https://github.com/MateoGonzalezLourido)**

</div>

