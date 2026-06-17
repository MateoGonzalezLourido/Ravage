# Vault de Variables de Entorno

## ¿Qué es?

El vault es un sistema que cifra los archivos `.env` del proyecto usando la API nativa del sistema operativo (`safeStorage` de Electron), y los elimina del disco en texto plano. En arranques posteriores, las variables se leen directamente desde los archivos cifrados del baúl.

El objetivo es que **las credenciales nunca queden en disco en texto plano** tras el primer arranque de la app.

---

## Archivos implicados

| Archivo | Rol |
|---|---|
| `env/.env.secret` | Variables sensibles (MongoDB, claves, API keys). Se consume una sola vez. |
| `env/.env.config` | Configuración interna de la app. Se consume una sola vez. |
| `backend/utils/env_vault.js` | Lógica del vault: migración, cifrado y carga. |
| `<userData>/env_vault/*.enc` | Archivos cifrados persistentes. Los gestiona el vault, no tocar a mano. |

Los archivos `.example` en `Docs/env_doc/` sirven de plantilla y **nunca** son procesados por el vault (se ignoran por extensión).

---

## Flujo de arranque

```
app.whenReady()
       │
       ▼
  ¿Hay .env en env/?
       │
    Sí │                          No │
       ▼                             ▼
  cifrar con safeStorage        ¿Hay .enc en userData/env_vault/?
  escribir .enc en userData/          │
  borrar .env original             Sí │              No │
       │                             ▼                  ▼
       └──────────────────► descifrar .enc        (sin vars)
                             inyectar en
                             process.env
```

1. **Migración** (`migrarEnvAlBaul`): detecta `.env` no vacíos en `env/`, los cifra con `safeStorage.encryptString()`, escribe el `.enc` en `<userData>/env_vault/` y, solo si la escritura fue exitosa, borra el original.
2. **Carga** (`cargarDesdeVaul`): lee los `.enc` del baúl, los descifra con `safeStorage.decryptString()`, parsea las variables y las inyecta en `process.env`. El baúl tiene prioridad sobre cualquier carga previa de dotenv.

Ambas funciones son invocadas por `inicializarVault()` dentro de `app.whenReady()` en `main.js`, antes de arrancar el servidor y la conexión a MongoDB.

---

## Backend de cifrado por SO

`safeStorage` delega el cifrado al llavero nativo del sistema operativo:

| SO | Backend |
|---|---|
| Linux | libsecret (gnome-keyring / kwallet) |
| Windows | DPAPI |
| macOS | Keychain |

Si el llavero no está disponible (p. ej. entorno headless sin gnome-keyring), el vault muestra un aviso y **no migra ni carga**. Los `.env` originales permanecen en disco sin cifrar.

---

## Ruta del baúl

Los `.enc` se almacenan en:

```
<userData>/env_vault/<nombre-original>.enc
```

`<userData>` es la ruta que devuelve `app.getPath('userData')` de Electron. Ejemplos típicos:

- **Linux**: `~/.config/Ravage/env_vault/`
- **Windows**: `%APPDATA%\Ravage\env_vault\`
- **macOS**: `~/Library/Application Support/Ravage/env_vault/`

---

## Primer uso

1. Copia los archivos de ejemplo y rellénalos:

   ```bash
   cp Docs/env_doc/.env.secret.example env/.env.secret
   cp Docs/env_doc/.env.config.example env/.env.config
   ```

2. Edita `env/.env.secret` y `env/.env.config` con los valores reales.

3. Arranca la app. El vault migra y cifra los archivos automáticamente. Los `.env` desaparecen del directorio `env/`.

A partir del segundo arranque **no hace falta volver a crear los `.env`**; el vault los tiene cifrados.

---

## Re-migración y actualización de variables

Si necesitas cambiar una variable:

1. Crea de nuevo el `.env` correspondiente en `env/` con el contenido actualizado.
2. Arranca la app. El vault detecta el archivo, lo cifra y sobreescribe el `.enc` anterior.

---

## Comportamiento ante errores

- Si el cifrado de un archivo falla, el original **no se borra** y se registra el error en consola con prefijo `[EnvVault]`.
- Si el descifrado de un `.enc` falla, ese archivo se omite y el resto se sigue cargando.
- Los errores no detienen el arranque de la app; el proceso continúa con las variables que sí se pudieron cargar.

---

## Variables disponibles

Ver los archivos de ejemplo para la lista completa:

- [`Docs/env_doc/.env.secret.example`](.env.secret.example) — credenciales y claves
- [`Docs/env_doc/.env.config.example`](.env.config.example) — configuración interna
