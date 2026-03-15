# Ravage (Alpha) *Este README esta desactualizado

Aplicación de transferencia de archivos P2P entre ordenadores usando SFTP. Diseñada específicamente para usuarios de la FIC que deseen participar en su uso o desarrollo.

## 🚀 Instalación y Configuración

Sigue estos pasos para poner en marcha el proyecto en tu entorno local.

### 1. Requisitos Previos

Asegúrate de tener instalados los siguientes componentes:

- **Node.js** (Versión 18 o superior recomendada)
- **Git**
- **MongoDB** (Local o una instancia en Atlas)

### 2. Clonar el Repositorio

```bash
git clone https://github.com/MateoGonzalezLourido/Ravage.git
cd Ravage
```

### 3. Instalar Dependencias

Desde el directorio raíz del proyecto, ejecuta:

```bash
npm install
```

Si prefieres instalarlas manualmente una a una:

```bash
npm install @getbrevo/brevo bcryptjs brevo dotenv express jsonwebtoken keytar mongodb mongoose node-machine-id systeminformation validator
npm install --save-dev electron standard
```

### 4. Configuración de Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto (basado en la configuración requerida) con las siguientes claves:

```env
URI_MONGODB=tu_uri_de_mongodb
SECRET_KEY_JWT=tu_clave_secreta_jwt
SECRET_KEY_COKKIE=tu_clave_secreta_cookie
BREVO_API_KEY=tu_api_key_de_brevo
BREVO_SENDER_EMAIL=tu_email_remitente
SALTOS_ENCRIPTAR_CONTRASENA=14
```

> [!IMPORTANT]
> Nunca compartas tu archivo `.env` ni lo subas a repositorios públicos.

### 5. Ejecutar la Aplicación

Para iniciar la aplicación en modo desarrollo con Electron:

```bash
npm start
```

## 🛠️ Tecnologías Principales

- **Frontend:** Electron, HTML, CSS, JS
- **Backend:** Node.js, Express
- **Base de Datos:** MongoDB (Mongoose)
- **Seguridad:** bcryptjs, jsonwebtoken
- **Comunicación:** Brevo (Emailing)
- **Sistema:** systeminformation, node-machine-id
