# Autenticación Socket.IO

Ravage usa Socket.IO para entregar notificaciones del buzón en tiempo real a clientes conectados. Sin autenticación, cualquier proceso podría conectarse al servidor, unirse a la sala de cualquier usuario y recibir sus notificaciones. Este documento describe el mecanismo de protección implementado.

---

## 1. Modelo de amenaza

| Escenario | Sin auth | Con auth |
|---|---|---|
| Proceso local malicioso se conecta a `localhost:3000` y escucha notificaciones de otro usuario | Posible | Bloqueado |
| Cliente remoto se conecta al servidor Railway y suplanta un userId | Posible | Bloqueado |
| Atacante enumera userIds y se suscribe a todas las salas | Posible | Bloqueado |
| Proceso legítimo de la app conecta al servidor | Funciona (tenía acceso sin restricción) | Funciona (presenta token) |

---

## 2. Implementación

### Servidor local (Electron — `serverLocalHost.js`)

Al arrancar el servidor se genera un token efímero aleatorio de 64 caracteres hex:

```js
_socketSecret = randomBytes(32).toString('hex');
```

Este token es **distinto en cada ejecución** de la app y `_socketSecret` es privado al módulo:
no se exporta. (Existió un `getSocketSecret()` exportado, pero se eliminó al no tener ningún
consumidor; el token solo se compara dentro del propio middleware.)

El middleware de Socket.IO rechaza cualquier conexión que no presente el token exacto:

```js
io.use((socket, next) => {
    if (socket.handshake.auth?.token === _socketSecret) return next();
    log.warn({ socketId: socket.id }, 'Conexión Socket.IO rechazada: token inválido');
    next(new Error('No autorizado'));
});
```

El token se transmite en el campo `auth` del handshake de Socket.IO (no en una cabecera HTTP ni en la URL), que viaja en el cuerpo del WebSocket upgrade — no queda en logs de acceso ni en URLs.

### Servidor de producción (Railway — `serverRailway.js`)

Lee el secreto desde la variable de entorno `SOCKET_SECRET`:

```js
const socketSecret = process.env.SOCKET_SECRET;
```

Si `SOCKET_SECRET` no está definida, el servidor arranca pero **rechaza todas las conexiones** (fail-closed): ningún cliente puede conectarse mientras la variable no esté configurada.

**Configuración requerida en Railway:** añade la variable de entorno `SOCKET_SECRET` con un valor aleatorio largo. Para generarlo:

```bash
openssl rand -hex 32
```

---

## 3. Flujo de conexión autorizada

```
[Cliente Socket.IO]
        │
        │  WebSocket upgrade + { auth: { token: "<secreto>" } }
        ▼
io.use() — middleware de autenticación
        │
        ├─ token inválido → next(Error('No autorizado')) → conexión rechazada (código 401)
        │
        └─ token válido → next() → socket admitido
                │
                ▼
        io.on("connection", socket => {
            socket.on("identificar", userId => {
                socket.join(userId);   // se une a la sala del usuario
            });
        });
```

Una vez en la sala, el cliente recibe los eventos `nueva-notificacion` que el Change Stream del buzón emite con `io.to(userId).emit(...)`.

---

## 4. Qué se eliminó

`chat_ipc.js` tenía esta línea antes de iniciar el buzón:

```js
socket.emit("identificar", userId);  // socket === io (instancia del servidor)
```

`io.emit(event, data)` transmite a **todos los sockets conectados**. Esto enviaba el `userId` del usuario actual a cualquier proceso conectado al servidor Socket.IO — una fuga de metadatos. La línea se eliminó: el servidor no necesita emitirse un evento a sí mismo para arrancar el Change Stream.

---

## 5. Archivos relevantes

| Archivo | Rol |
|---|---|
| `backend/servidores/serverLocalHost.js` | Genera el token efímero al arrancar; lo mantiene privado al módulo |
| `backend/servidores/serverRailway.js` | Lee `SOCKET_SECRET` de env; mismo middleware |
| `backend/ipc/chat_ipc.js` | Arranca el buzón vía `iniciarBuzon(io, mainWindow)`; ya no emite el userId a todos |
| `backend/services/buzonAPI.js` | Usa `io.to(userId).emit(...)` para entregar notificaciones a la sala del usuario |
