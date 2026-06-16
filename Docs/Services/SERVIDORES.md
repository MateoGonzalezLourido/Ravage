# Servidores

Ravage tiene dos plantillas de servidor en `backend/servidores/`. Ambas montan Express + Socket.IO sobre HTTP, pero están ajustadas para entornos distintos. Solo se usa una a la vez.

| Archivo | Entorno | Puerto | Arranca desde |
|---|---|---|---|
| `serverLocalHost.js` | Desarrollo / Electron embebido | Dinámico (SO elige un puerto libre) | `main.js` al arrancar la app |
| `serverRailway.js` | Producción (Railway) | `process.env.PORT` (dinámico) | Directamente por el proceso de Railway |

---

## 1. Servidor local (`serverLocalHost.js`)

Pensado para correr embebido dentro del proceso principal de Electron. El servidor escucha en `localhost:3000` y solo acepta conexiones locales.

### Arranque

`main.js` importa `startServer` y lo llama al iniciar:

```js
socket = await startServer();   // devuelve la instancia io del servidor
```

El `io` devuelto se pasa a `registerChatHandlers(window, io)` y de ahí a `iniciarBuzon(io, mainWindow)`, que usa `io.to(userId).emit(...)` para entregar notificaciones del buzón.

### Stack de middleware (en orden de ejecución)

```
Petición entrante
   │
   ├─ express.json()            — parsea body JSON
   ├─ express-rate-limit        — máx. 300 req / 15 min por IP
   ├─ CORS middleware           — ver sección CORS
   ├─ GET /                     — health check
   └─ Socket.IO (upgrade WS)   — auth middleware → handler de conexión
```

### CORS

Como el puerto es dinámico, los orígenes se validan mediante una expresión regular en vez de una lista fija:

```js
const ALLOWED_ORIGINS_LOCAL = /^http:\/\/localhost(:\d+)?$/;
```

Esto permite cualquier puerto de localhost, lo cual es correcto: el servidor es solo accesible desde la misma máquina y ningún origen externo puede llegar a `localhost`.

Comportamiento:
- Solo añade `Access-Control-Allow-Origin` si el `Origin` de la petición hace match con la regex — nunca envía `*`.
- Incluye `Vary: Origin` para que cachés y proxies no sirvan respuestas CORS de un origen a otro.
- Responde `204 No Content` a los preflights `OPTIONS` antes de llegar a cualquier ruta.
- Peticiones sin header `Origin` (herramientas CLI, server-to-server): no reciben header CORS — no lo necesitan.

La misma regex se usa en la configuración `cors` de Socket.IO, para que ambas capas sean coherentes.

### Autenticación Socket.IO

Al arrancar genera un token aleatorio efímero (64 hex chars):

```js
_socketSecret = randomBytes(32).toString('hex');
```

Cualquier conexión que no presente ese token exacto en `socket.handshake.auth.token` es rechazada. Ver `Docs/Services/seguridad/SOCKETIO_AUTH.md` para más detalle.

### Plantilla HTTPS (comentada)

El archivo incluye una plantilla comentada para activar HTTPS con certificados locales. Para usarla:

1. Genera los certificados:
   ```bash
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   ```
2. Colócalos en `backend/certs/`.
3. Descomenta el bloque `https.createServer(httpsOptions, app)` y comenta el `http.createServer(app)`.

---

## 2. Servidor Railway (`serverRailway.js`)

Pensado para desplegarse como servicio independiente en Railway (o cualquier plataforma PaaS). Expone el mismo stack pero con configuración para producción.

### Diferencias respecto al servidor local

| Aspecto | Local | Railway |
|---|---|---|
| Puerto | Dinámico (SO elige un puerto libre) | `process.env.PORT` (Railway lo asigna) |
| Host | `localhost` implícito | `0.0.0.0` (todas las interfaces) |
| `trust proxy` | No | `1` (para obtener la IP real tras el proxy de Railway) |
| Rate limit | 300 req/15 min | 100 req/15 min |
| Orígenes CORS | Lista fija en código | `CLIENT_URL` del entorno |
| Token Socket.IO | Generado al arrancar | `SOCKET_SECRET` del entorno |
| Arranque autónomo | No | Sí (detecta `process.argv[1]`) |

### Arranque autónomo

El archivo detecta si es el punto de entrada del proceso y arranca solo:

```js
if (process.argv[1]?.includes('serverRailway.js')) {
    await connectDB();
    await startServer();
}
```

Esto permite que Railway ejecute directamente `node backend/servidores/serverRailway.js` sin necesitar un `main.js` de Electron.

### CORS

Los orígenes se leen de la variable de entorno `CLIENT_URL`. Puede ser una URL única o una lista separada por comas:

```
CLIENT_URL=https://mi-app.com
CLIENT_URL=https://mi-app.com,https://admin.mi-app.com
```

**Fail-closed**: si `CLIENT_URL` no está definida, `ALLOWED_ORIGINS` queda vacío y ningún origen recibe cabeceras CORS. Las peticiones de origen cruzado serán bloqueadas por el navegador. Se registra un log `fatal` al arrancar.

Socket.IO usa la misma lista. Si está vacía, `origin: false` deshabilita CORS en Socket.IO también.

### Variables de entorno requeridas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `PORT` | Puerto donde escucha (Railway lo inyecta automáticamente) | `8080` |
| `CLIENT_URL` | Origen(es) permitidos para CORS, separados por coma | `https://mi-app.com` |
| `SOCKET_SECRET` | Token para autenticar conexiones Socket.IO | `openssl rand -hex 32` |

Si alguna de las tres falta al arrancar, el servidor loguea un error `fatal` y opera en modo degradado (bloqueando las conexiones afectadas).

---

## 3. Comportamiento CORS — referencia rápida

| Caso | Local | Railway |
|---|---|---|
| `Origin` en lista permitida | `ACAO: <origin>` + `Vary: Origin` | `ACAO: <origin>` + `Vary: Origin` |
| `Origin` no permitido | Sin header ACAO (bloqueado por navegador) | Sin header ACAO (bloqueado por navegador) |
| Sin header `Origin` (CLI, server-to-server) | Sin header ACAO (no hace falta) | Sin header ACAO (no hace falta) |
| Preflight `OPTIONS` | `204 No Content` | `204 No Content` |
| `CLIENT_URL` no definida (Railway) | — | ACAO nunca se envía (fail-closed) |

`ACAO` = `Access-Control-Allow-Origin`

---

## 4. Añadir un servidor nuevo

Para crear una variante (ej. para otro proveedor cloud), la plantilla mínima es:

1. Importar `express`, `Server` (Socket.IO), `http` de `../utils/libs.js`.
2. Definir/leer los orígenes CORS permitidos — **nunca usar `*` ni dejar fallback abierto**.
3. Aplicar el middleware CORS con `Vary: Origin` y manejo de OPTIONS.
4. Aplicar rate limiting.
5. Crear el servidor HTTP y la instancia Socket.IO con los mismos orígenes.
6. Registrar el middleware de autenticación de Socket.IO antes de `io.on("connection")`.
7. Exportar `startServer`, `stopServer` e `io`.
