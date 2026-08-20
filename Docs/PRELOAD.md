# Documentación del Preload Script en RAVAGE

> **Nota.** Este documento es el resumen histórico (en español) del sistema de preload y cubre solo el
> *porqué* del bundle y las buenas prácticas. La referencia completa y verificada contra el código —
> todos los módulos, cada función expuesta y su canal IPC — está en
> [`Docs/frontend/PRELOAD.md`](./frontend/PRELOAD.md). Ante cualquier discrepancia, manda ese documento.

El script de **preload** es el puente principal entre el `frontend` (proceso de renderizado) y el `backend` (proceso principal de Electron). Su función es exponer APIs limitadas y seguras al navegador mediante el uso de `contextBridge`.

## 1. Estructura del Preload

Para mantener el código organizado y escalable, las funcionalidades del preload se dividen en módulos dentro de la carpeta `/preload/`. Cada módulo agrupa funciones relacionadas con un dominio lógico:

- `auth.cjs`: Gestión de sesiones y registros.
- `chat.cjs`: Operaciones de mensajería y gestión de chats.
- `navigation.cjs`: Cambio entre páginas de la aplicación.
- `security.cjs`: Escáneres de seguridad y limpieza de contenido.
- `user.cjs`: Datos de la cuenta del usuario.
- `storage.cjs`: Gestión de cachés y persistencia local.
- `validators.cjs`: Validaciones de datos (correo, apodo, contraseñas).
- `mailbox.cjs`: Notificaciones y buzón en tiempo real (Socket.io).
- `utils.cjs`: Utilidades generales (ej. previsualización de URLs).
- `social.cjs`: Contactos, bloqueos/silenciados y búsqueda de usuarios externos.
- `app_settings.cjs`: Ajustes de la app, claves de identidad, PIN y número de workers.
- `avisos.cjs`: Escuchadores de eventos backend → renderer (sentido único).
- `opciones_dev.cjs`: Bandera `isDev` para el modo desarrollador.

## 2. Definición del Puente (`preload.cjs`)

El archivo raíz `preload.cjs` actúa como el punto de entrada principal. Importa todos los módulos anteriores y los expone al objeto `window` del frontend mediante `contextBridge.exposeInMainWorld()`.

```javascript
const { contextBridge } = require('electron');
const auth = require('./preload/auth.cjs');
// ...
contextBridge.exposeInMainWorld('sesion_usuario', auth);
// ...
```

De esta forma, en el frontend (JS del navegador) podemos llamar a `window.sesion_usuario.LOGIN_USUARIO(...)` de forma segura.

## 3. ¿Por qué necesitamos un "Bundle"?

Electron utiliza un entorno de ejecución llamado **Sandbox** para el proceso de renderizado por motivos de seguridad. Cuando el sandbox está activado (`sandbox: true` en `webPreferences` de `main.js`):

1.  **Resolución de Módulos**: El script de preload no puede resolver módulos locales de la misma forma que Node.js normal si el sandbox está activo.
2.  **Aislamiento**: No se permite el acceso a `require` de Node directamente desde el renderer.

Para solucionar esto, utilizamos **esbuild** para empaquetar (`bundle`) el script de entrada `preload.cjs` junto con todas sus dependencias en un único archivo independiente: `preload.bundle.cjs`.

## 4. El Proceso de Construcción (Build)

El comando de construcción está definido en el `package.json`:

```bash
npm run build-preload
```

Este comando ejecuta:
`esbuild preload.cjs --bundle --platform=node --external:electron --outfile=preload.bundle.cjs`

### Integración en el flujo de trabajo:
- **`npm start`**: Ejecuta automáticamente `npm run build-preload` antes de lanzar la aplicación Electron. Esto asegura que cualquier cambio en los archivos de la carpeta `preload/` se vea reflejado al iniciar la app.
- **`main.js`**: Está configurado para cargar siempre el archivo generado:
  ```javascript
  webPreferences: {
      preload: path.join(__dirname, 'preload.bundle.cjs'),
      // ...
  }
  ```

## 5. Mantenimiento y Buenas Prácticas

- **No editar `preload.bundle.cjs`**: Este archivo se sobrescribe en cada build. Realiza los cambios únicamente en `preload.cjs` o en los archivos dentro de la carpeta `preload/`.
- **Exposición Segura**: Nunca expongas módulos completos de Node (como `fs` o `crypto`) directamente. Crea envoltorios (`wrappers`) en el preload que usen IPC (`ipcRenderer.invoke` o `ipcRenderer.send`) para que el backend realice la operación real.
- **Tipado de Archivos**: Al usar `"type": "module"` en el proyecto, el preload debe mantener la extensión `.cjs` (CommonJS) para ser compatible con la configuración actual de empaquetado y sandbox.

---
*Manual de Arquitectura de RAVAGE - Preload System*
