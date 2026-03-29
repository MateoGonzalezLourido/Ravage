# Guía de Contribución: RAVAGE 🔒

¡Gracias por interesarte en mejorar **Ravage**! Como proyecto abierto, agradecemos cualquier ayuda, desde reportar errores hasta proponer nuevas funcionalidades criptográficas o mejoras en la UI.

## 🚀 Cómo empezar

1.  **Haz un Fork** del repositorio.
2.  **Clona** tu fork localmente: `git clone https://github.com/tu-usuario/Ravage.git`.
3.  **Instala las dependencias**: `npm install`.
4.  **Configura tu entorno**: Copia `.env.example` a `.env` y rellena con tus claves de prueba (MongoDB Altas, Brevo).

## 🛠 Proceso de Desarrollo

- **Ramas**: Crea una rama descriptiva para tu cambio: `git checkout -b feature/mejora-especifica` o `git checkout -b fix/error-encontrado`.
- **Estándar de Código**: Intentamos seguir el estándar de JavaScript (ESM). Usamos `standard` para el linting básico.
- **Tests**: Si añades lógica nueva a `cryptoService` o `validadores`, añade un test unitario en la carpeta `backend/tests/` y ejecútalo con `npm run test`.

## 📍 Qué puedes aportar

- **Seguridad**: Auditorías del protocolo de Ratchet o sugerencias de mejora en el cifrado AES-GCM.
- **Frontend**: Mejoras en la interfaz de Electron, animaciones o accesibilidad.
- **Backend**: Refactorización de repositorios, optimización de consultas Mongoose o mejoras en el sistema de caché.
- **Tests**: Añadir tests a funciones existentes o nuevas.
- **Documentación**: Mejoras en la documentación.
- **Logs**: Mejoras en el sistema de logs.
- **Rate Limiting**: Mejoras en el sistema de rate limiting.
- **Servidores**: Mejoras en los servidores.

**Nota**: si quieres hacer otra cosa, no dudes en proponerlo.

## 📤 Enviar tus cambios

1.  Haz un **Push** de tu rama a tu fork.
2.  Abre un **Pull Request** detallando:
    - Qué problema soluciona.
    - Qué cambios técnicos has realizado.
    - Cómo lo has verificado.

---

**Nota Legal**: Al contribuir, aceptas que tu código esté bajo la **ISC License** de Ravage.
