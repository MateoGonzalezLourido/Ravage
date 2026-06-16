// /home/Paraguayo33/Documentos/!PROGRAMACION/!P_PROPIOS/Ravage/backend/services/MENSAJERIA/Estructuras_correos.js

/**
 * Generates a full-viewport responsive wrapper for email compatibility.
 * Uses table layout for reliable rendering in all mail clients (Gmail, Outlook, Apple Mail).
 */
const BaseEmailWrapper = (content) => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #020617; }
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
        
        /* Dark mode overrides (for clients that support it, but default is already dark) */
        :root {
            color-scheme: dark;
            supported-color-schemes: dark;
        }
    </style>
</head>
<body style="background-color: #020617; margin: 0 !important; padding: 0 !important; -webkit-font-smoothing: antialiased;">

<!-- Background Table -->
<table border="0" cellpadding="0" cellspacing="0" width="100%" height="100%" style="background-color: #020617;">
    <tr>
        <td align="center" valign="top" style="padding: 20px 15px;">
            
            <!-- Main Content Container -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                
                <!-- Header -->
                <tr>
                    <td align="center" style="padding: 25px 0 20px 0; border-bottom: 1px solid #1e293b; background-color: #0f172a;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: 3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">RAVAGE</h1>
                        <div style="height: 4px; width: 40px; background-color: #06b6d4; margin-top: 10px; border-radius: 2px; font-size: 1px; line-height: 1px;">&nbsp;</div>
                    </td>
                </tr>

                <!-- Content Body -->
                <tr>
                    <td align="left" style="padding: 30px; color: #cbd5e1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; background-color: #0f172a;">
                        ${content}
                    </td>
                </tr>

                <!-- Footer -->
                <tr>
                    <td align="center" style="padding: 20px 30px; background-color: #0b1120; border-top: 1px solid #1e293b;">
                        <span style="color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; font-weight: 500; letter-spacing: 1px; display: block;">
                            MATEO'S STAGE &bull; RAVAGE TEAM &bull; ${new Date().getFullYear()}
                        </span>
                        <span style="color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; margin-top: 6px; display: block;">
                            Este es un correo autom&aacute;tico, por favor no respondas.
                        </span>
                    </td>
                </tr>
            </table>

            <!-- Bottom spacing -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr><td height="20" style="font-size: 1px; line-height: 1px;">&nbsp;</td></tr>
            </table>

        </td>
    </tr>
</table>

</body>
</html>
`;

const ValidarCorreoEstructura = ({ apodo = "Usuario", code }) => {
    const asunto = "Verificación de correo"
    const htmlContenido = BaseEmailWrapper(`
        <p style="margin: 0 0 15px 0; color: #f8fafc; font-size: 18px;">Hola, <strong style="color: #06b6d4;">${apodo}</strong>.</p>
        <p style="margin: 0 0 25px 0;">Copia y pega este c&oacute;digo en la aplicaci&oacute;n para verificar tu cuenta:</p>
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
            <tr>
                <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 300px; background-color: #020617; border: 1px solid #334155; border-radius: 12px;">
                        <tr>
                            <td align="center" style="padding: 20px;">
                                <!-- Fallback font families in case ui-monospace is not available -->
                                <span style="color: #06b6d4; font-size: 38px; font-weight: 800; letter-spacing: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace; display: block; user-select: all; -webkit-user-select: all; cursor: copy;" title="Haz clic para seleccionar todo y cópialo">${code}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        
        <p style="font-size: 14px; color: #64748b; margin: 0; text-align: center;">
            Este c&oacute;digo es v&aacute;lido durante <strong>10 minutos</strong>. Si no has sido t&uacute;, ignora este mensaje.
        </p>
    `);
    return { asunto, htmlContenido };
}

const ConfirmacionCuentaCreadaEstructura = ({ apodo }) => {
    const asunto = "¡Bienvenido a RAVAGE!"
    const htmlContenido = BaseEmailWrapper(`
        <h2 style="color: #ffffff; font-size: 22px; margin: 0 0 15px 0; text-align: center;">¡Registro Completado!</h2>
        <p style="margin: 0 0 25px 0; text-align: center; font-size: 16px;">Tu cuenta como <strong style="color: #06b6d4;">${apodo}</strong> ha sido verificada y activada correctamente.</p>
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
                <td align="center">
                    <!-- Button simulation with solid background and border radius -->
                    <table border="0" cellpadding="0" cellspacing="0" style="background-color: #06b6d4; border-radius: 8px;">
                        <tr>
                            <td align="center" style="padding: 14px 28px; background: linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%); border-radius: 8px;">
                                <span style="color: #ffffff; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Ya puedes acceder</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    `);
    return { asunto, htmlContenido };
}

const ValidarCuentaUsuario = ({ apodo, code }) => {
    const asunto = "Verificación de seguridad"
    const htmlContenido = BaseEmailWrapper(`
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
            <tr>
                <td align="center">
                    <span style="display: inline-block; padding: 6px 12px; background-color: #064e3b; border: 1px solid #10b981; border-radius: 100px; color: #34d399; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
                        Autenticación de dispositivo
                    </span>
                </td>
            </tr>
        </table>

        <p style="margin: 0 0 25px 0; text-align: center; font-size: 16px;">Hola <strong style="color: #f8fafc;">${apodo}</strong>, usa este c&oacute;digo para autorizar el acceso:</p>
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
            <tr>
                <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" style="background-color: #020617; border: 2px solid #22c55e; border-radius: 12px;">
                        <tr>
                            <td align="center" style="padding: 20px 35px;">
                                <span style="color: #22c55e; font-size: 38px; font-weight: 800; letter-spacing: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace; display: block; user-select: all; -webkit-user-select: all; cursor: copy;" title="Haz clic para seleccionar todo y cópialo">${code}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        
        <p style="font-size: 14px; color: #64748b; margin: 0; text-align: center;">
            No compartas este c&oacute;digo con nadie.
        </p>
    `);
    return { asunto, htmlContenido };
}

const ConfirmacionInicioSesion = () => {
    const asunto = "Alerta de Inicio de Sesión"
    const htmlContenido = BaseEmailWrapper(`
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; background-color: #1e1b14; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0;">
            <tr>
                <td style="padding: 15px 20px;">
                    <h2 style="color: #f59e0b; font-size: 18px; margin: 0 0 8px 0; font-weight: 700;">Nuevo acceso detectado</h2>
                    <p style="margin: 0; color: #e2e8f0; font-size: 15px;">Se ha detectado un inicio de sesi&oacute;n reciente en tu cuenta de Ravage.</p>
                </td>
            </tr>
        </table>
        
        <p style="font-size: 15px; color: #94a3b8; line-height: 1.5; margin: 0;">
            Si has sido t&uacute;, puedes ignorar este mensaje tranquilamente.<br><br>
            <strong style="color: #ef4444;">Si no reconoces esta actividad</strong>, te recomendamos cambiar tu contrase&ntilde;a desde la aplicaci&oacute;n inmediatamente.
        </p>
    `);
    return { asunto, htmlContenido };
}

const CodigoCambiarDatosCuenta = ({ apodo, codigo, tipo }) => {
    const asunto = "Confirmación de Cambios"
    const htmlContenido = BaseEmailWrapper(`
        <p style="margin: 0 0 20px 0; text-align: center; font-size: 16px;">Hola <strong style="color: #ffffff;">${apodo}</strong>, solicitaste cambiar tu <strong style="color: #06b6d4;">${tipo}</strong>.</p>
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 25px;">
            <tr>
                <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" style="background-color: #020617; border: 2px dashed #475569; border-radius: 12px; width: 250px;">
                        <tr>
                            <td align="center" style="padding: 15px;">
                                <span style="color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace; display: block; user-select: all; -webkit-user-select: all; cursor: copy;" title="Haz clic para seleccionar todo y cópialo">${codigo}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        
        <p style="font-size: 14px; color: #64748b; margin: 0; text-align: center;">
            Usa este c&oacute;digo para autorizar la actualización.
        </p>
    `);
    return { asunto, htmlContenido };
}

const ConfirmacionCambioContraseña = ({ apodo }) => {
    const asunto = "Contraseña Actualizada"
    const htmlContenido = BaseEmailWrapper(`
        <div style="text-align: center; margin-bottom: 15px;">
            <table border="0" cellpadding="0" cellspacing="0" align="center">
                <tr>
                    <td align="center" valign="middle" style="width: 56px; height: 56px; background-color: #064e3b; border-radius: 50%; border: 2px solid #10b981;">
                        <span style="font-size: 24px; line-height: 24px;">🛡️</span>
                    </td>
                </tr>
            </table>
        </div>
        
        <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 15px 0; text-align: center;">Seguridad Actualizada</h2>
        <p style="text-align: center; margin: 0 0 25px 0; font-size: 16px;">Hola <strong style="color: #06b6d4;">${apodo}</strong>, tu contrase&ntilde;a ha sido modificada con &eacute;xito.</p>
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
                <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" style="background-color: #064e3b; border-radius: 6px; border: 1px solid #10b981;">
                        <tr>
                            <td align="center" style="padding: 8px 16px;">
                                <span style="color: #34d399; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">Estado: Transacción Segura</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    `);
    return { asunto, htmlContenido };
}

const ConfirmacionCambioCorreo = ({ apodo }) => {
    const asunto = "Cambio de Email"
    const htmlContenido = BaseEmailWrapper(`
        <div style="text-align: center; margin-bottom: 15px;">
            <span style="font-size: 36px; display: block;">✉️</span>
        </div>
        <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 15px 0; text-align: center;">Email Registrado</h2>
        <p style="text-align: center; margin: 0; font-size: 15px; line-height: 1.5;">
            Hola <strong style="color: #06b6d4;">${apodo}</strong>,<br>
            Tu direcci&oacute;n de correo electr&oacute;nico ha sido actualizada correctamente en nuestros sistemas de seguridad.
        </p>
    `);
    return { asunto, htmlContenido };
}

const _bloqueInfoDispositivo = (nombre, sistemaOperativo, fecha) => `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 18px 0; background-color: #0b1120; border: 1px solid #1e293b; border-radius: 10px;">
    <tr>
        <td style="padding: 16px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                ${nombre ? `<tr><td style="padding: 4px 0; border-bottom: 1px solid #1e293b;"><span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Dispositivo</span><br><strong style="color:#e2e8f0;font-size:14px;">${nombre}</strong></td></tr>` : ''}
                ${sistemaOperativo ? `<tr><td style="padding: 4px 0; border-bottom: 1px solid #1e293b;"><span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Sistema operativo</span><br><strong style="color:#e2e8f0;font-size:14px;">${sistemaOperativo}</strong></td></tr>` : ''}
                <tr><td style="padding: 4px 0;"><span style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Fecha y hora</span><br><strong style="color:#e2e8f0;font-size:14px;">${fecha}</strong></td></tr>
            </table>
        </td>
    </tr>
</table>`;

const AvisoDispositivoConfianzaAnadido = ({ apodo, nombre, sistemaOperativo, fecha }) => {
    const asunto = "Nuevo dispositivo de confianza añadido";
    const htmlContenido = BaseEmailWrapper(`
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; background-color: #052e16; border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0;">
            <tr>
                <td style="padding: 14px 18px;">
                    <h2 style="color: #22c55e; font-size: 17px; margin: 0 0 5px 0; font-weight: 700;">Dispositivo de confianza a&ntilde;adido</h2>
                    <p style="margin: 0; color: #e2e8f0; font-size: 14px;">Un nuevo dispositivo ya puede iniciar sesi&oacute;n sin verificaci&oacute;n.</p>
                </td>
            </tr>
        </table>

        <p style="margin: 0 0 6px 0; font-size: 15px;">Hola, <strong style="color: #f8fafc;">${apodo}</strong>.</p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #94a3b8;">El siguiente dispositivo ha sido marcado como de confianza en tu cuenta:</p>

        ${_bloqueInfoDispositivo(nombre, sistemaOperativo, fecha)}

        <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0;">
            <strong style="color: #ef4444;">¿No has sido t&uacute;?</strong> Accede a los ajustes de la aplicaci&oacute;n, revoca la confianza de ese dispositivo y cambia tu contrase&ntilde;a de inmediato.
        </p>
    `);
    return { asunto, htmlContenido };
};

const AvisoDispositivoConfianzaRevocado = ({ apodo, nombre, sistemaOperativo, fecha }) => {
    const asunto = "Dispositivo de confianza eliminado";
    const htmlContenido = BaseEmailWrapper(`
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; background-color: #2c1502; border-left: 4px solid #f97316; border-radius: 0 8px 8px 0;">
            <tr>
                <td style="padding: 14px 18px;">
                    <h2 style="color: #f97316; font-size: 17px; margin: 0 0 5px 0; font-weight: 700;">Confianza de dispositivo revocada</h2>
                    <p style="margin: 0; color: #e2e8f0; font-size: 14px;">Un dispositivo ya no puede iniciar sesi&oacute;n sin verificaci&oacute;n.</p>
                </td>
            </tr>
        </table>

        <p style="margin: 0 0 6px 0; font-size: 15px;">Hola, <strong style="color: #f8fafc;">${apodo}</strong>.</p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #94a3b8;">El siguiente dispositivo necesitar&aacute; verificaci&oacute;n por correo en su pr&oacute;ximo inicio de sesi&oacute;n:</p>

        ${_bloqueInfoDispositivo(nombre, sistemaOperativo, fecha)}

        <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0;">
            Si has sido t&uacute;, puedes ignorar este mensaje.
            <strong style="color: #ef4444;">Si no reconoces esta acci&oacute;n</strong>, alguien tiene acceso a tu cuenta — cambia tu contrase&ntilde;a inmediatamente.
        </p>
    `);
    return { asunto, htmlContenido };
};

const AvisoSesionCerrada = ({ apodo, nombre, sistemaOperativo, fecha }) => {
    const asunto = "Sesión de dispositivo cerrada";
    const htmlContenido = BaseEmailWrapper(`
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; background-color: #1c0a2e; border-left: 4px solid #a855f7; border-radius: 0 8px 8px 0;">
            <tr>
                <td style="padding: 14px 18px;">
                    <h2 style="color: #a855f7; font-size: 17px; margin: 0 0 5px 0; font-weight: 700;">Sesi&oacute;n cerrada remotamente</h2>
                    <p style="margin: 0; color: #e2e8f0; font-size: 14px;">El acceso autom&aacute;tico de un dispositivo ha sido eliminado.</p>
                </td>
            </tr>
        </table>

        <p style="margin: 0 0 6px 0; font-size: 15px;">Hola, <strong style="color: #f8fafc;">${apodo}</strong>.</p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #94a3b8;">La sesi&oacute;n guardada del siguiente dispositivo ha sido eliminada. Necesitar&aacute; credenciales completas para volver a entrar:</p>

        ${_bloqueInfoDispositivo(nombre, sistemaOperativo, fecha)}

        <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0;">
            Si has sido t&uacute;, puedes ignorar este mensaje.
            <strong style="color: #ef4444;">Si no reconoces esta acci&oacute;n</strong>, cambia tu contrase&ntilde;a inmediatamente.
        </p>
    `);
    return { asunto, htmlContenido };
};

const AvisoDispositivoBloqueado = ({ apodo, nombre, sistemaOperativo, fecha }) => {
    const asunto = "Dispositivo bloqueado en tu cuenta";
    const htmlContenido = BaseEmailWrapper(`
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; background-color: #1c0606; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0;">
            <tr>
                <td style="padding: 14px 18px;">
                    <h2 style="color: #ef4444; font-size: 17px; margin: 0 0 5px 0; font-weight: 700;">Dispositivo bloqueado</h2>
                    <p style="margin: 0; color: #e2e8f0; font-size: 14px;">Un dispositivo ha sido bloqueado para acceder a tu cuenta.</p>
                </td>
            </tr>
        </table>

        <p style="margin: 0 0 6px 0; font-size: 15px;">Hola, <strong style="color: #f8fafc;">${apodo}</strong>.</p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #94a3b8;">El siguiente dispositivo ya no podr&aacute; iniciar sesi&oacute;n en tu cuenta. Sus sesiones activas y confianza han sido eliminadas:</p>

        ${_bloqueInfoDispositivo(nombre, sistemaOperativo, fecha)}

        <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0;">
            Si has sido t&uacute;, puedes ignorar este mensaje.
            <strong style="color: #ef4444;">Si no reconoces esta acci&oacute;n</strong>, tu cuenta puede estar comprometida. Cambia tu contrase&ntilde;a inmediatamente y revisa los dispositivos activos desde los ajustes.
        </p>
    `);
    return { asunto, htmlContenido };
};

const AvisoDispositivoDesbloqueado = ({ apodo, nombre, sistemaOperativo, fecha }) => {
    const asunto = "Dispositivo desbloqueado en tu cuenta";
    const htmlContenido = BaseEmailWrapper(`
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; background-color: #0a1628; border-left: 4px solid #06b6d4; border-radius: 0 8px 8px 0;">
            <tr>
                <td style="padding: 14px 18px;">
                    <h2 style="color: #06b6d4; font-size: 17px; margin: 0 0 5px 0; font-weight: 700;">Dispositivo desbloqueado</h2>
                    <p style="margin: 0; color: #e2e8f0; font-size: 14px;">Un dispositivo puede volver a iniciar sesi&oacute;n en tu cuenta.</p>
                </td>
            </tr>
        </table>

        <p style="margin: 0 0 6px 0; font-size: 15px;">Hola, <strong style="color: #f8fafc;">${apodo}</strong>.</p>
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #94a3b8;">El bloqueo del siguiente dispositivo ha sido eliminado:</p>

        ${_bloqueInfoDispositivo(nombre, sistemaOperativo, fecha)}

        <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0;">
            Si has sido t&uacute;, puedes ignorar este mensaje.
            <strong style="color: #ef4444;">Si no reconoces esta acci&oacute;n</strong>, cambia tu contrase&ntilde;a inmediatamente.
        </p>
    `);
    return { asunto, htmlContenido };
};

const ConfirmacionCambioApodo = ({ apodo }) => {
    const asunto = "Apodo Actualizado"
    const htmlContenido = BaseEmailWrapper(`
        <div style="text-align: center; margin-bottom: 15px;">
            <span style="font-size: 36px; display: block;">👤</span>
        </div>
        <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 15px 0; text-align: center;">Perfil Actualizado</h2>
        <p style="text-align: center; margin: 0; font-size: 15px;">
            Tu identidad en la plataforma ha sido renovada.<br><br>
            Tu nuevo apodo registrado es:<br>
            <strong style="color: #06b6d4; font-size: 22px; display: inline-block; margin-top: 10px;">${apodo}</strong>
        </p>
    `);
    return { asunto, htmlContenido };
}

export {
    ValidarCorreoEstructura,
    ConfirmacionCuentaCreadaEstructura,
    ValidarCuentaUsuario,
    ConfirmacionInicioSesion,
    CodigoCambiarDatosCuenta,
    ConfirmacionCambioContraseña,
    ConfirmacionCambioCorreo,
    ConfirmacionCambioApodo,
    AvisoDispositivoConfianzaAnadido,
    AvisoDispositivoConfianzaRevocado,
    AvisoSesionCerrada,
    AvisoDispositivoBloqueado,
    AvisoDispositivoDesbloqueado
};
