# Documentación de Escáneres de Seguridad de Mensajes

Este documento explica cada uno de los escáneres implementados en `escanerMensaje.js`. Estos escáneres tienen el propósito de proteger a los usuarios de contenido malicioso, molesto o de intentos de ingeniería social (scams/phishing).

Como la aplicación está orientada al público general, algunos escáneres son muy estrictos y podrían dar falsos positivos si los usuarios intentan compartir comandos o fragmentos de código legítimamente. Por esta razón, la arquitectura permite activar o desactivar estas protecciones bajo la configuración específica de cada chat o ajuste de privacidad.

## 1. Esteganografía y Caracteres Invisibles (`detectSteganography`)
* **Qué detecta**: Caracteres de ancho cero, marcas de orden de bytes (BOM) y separadores invisibles (ej. caracteres en los rangos Unicode `\u200B`-`\u200F`).
* **Propósito**: Los atacantes utilizan estos caracteres invisibles para camuflar palabras prohibidas en los filtros de spam automáticos, o para "marcar" texto rastreando a usuarios.
* **Falsos positivos**: **MUY BAJO**. En una conversación normal del día a día, un usuario común nunca inserta estos caracteres de control intencionadamente.

## 2. Enlaces / URLs (`detectUrl`)
* **Qué detecta**: URLs estándar en texto plano o con prefijos `http/https`.
* **Propósito**: Detectar el envío de enlaces web para analizarlos, advertir al usuario o directamente bloquearlos. Representa el principal vector para el robo de cuentas o malware (Phishing).
* **Falsos positivos**: **BAJO**, porque detectará URLs correctamente. Su conveniencia radica en la configuración de la sala (Ej. impedir que cuentas con menos de X horas envíen enlaces).

## 3. Código Fuente y XSS (`detectarXSS` y `detectarCodigo`)
* **Qué detecta**: 
  * Etiquetas HTML de alto riesgo de secuencias de comandos entre sitios (`<script>`, `<iframe>`, `javascript:`, `onload=`, etc.).
  * Patrones de lenguajes de programación (variables, métodos) y comandos destructivos de bases de datos o comandos NoSQL (`SELECT`, `DROP`, `$where`).
* **Propósito**: Evitar vulnerabilidades de XSS y prevenir que un usuario convenza a la víctima de ejecutar fragmentos de código perjudiciales en la consola de sus navegadores locales (`Self-XSS`).
* **Falsos positivos**: **ALTO**. Si un usuario comparte código en la plataforma para debatir, ayudar a otros, o simplemente en su forma natural de escribir usa palabras como *"SELECT"*, el escáner lo interceptará.

## 4. Texto Zalgo (`detectarZalgo`)
* **Qué detecta**: La acumulación excesiva (3 o más) de caracteres combinables (diacríticos) superpuestos en una misma letra.
* **Propósito**: El texto "Zalgo" (ej. H̴̗͘e̵̱͝) se utiliza típicamente por roles perjudiciales o software malintencionado para romper las interfaces del cliente, superponer texto sobre áreas invisibles o causar fallos de rendimiento y "lag" en el frontend durante el renderizado fuente.
* **Falsos positivos**: **BAJO**. Virtualmente ninguna escritura convencional en ningún idioma humano requiere combinar más de tres acentos seguidos sobre la mismísima letra base.

## 5. Comandos de Terminal (`detectarComandosTerminal`)
* **Qué detecta**: Palabras clave y banderas nativas de la consola que desencadenan operaciones perversas generalistas en OS (ej. `sudo`, `rm -rf`, `chmod`, o `powershell`).
* **Propósito**: Minimizar el vector de ingeniería social *"Pega esto en la pantalla negra de tu computadora para que tu internet vaya más rápido"*. 
* **Falsos positivos**: **MEDIO/ALTO**. Entornos técnicos que intercambien ayudas entre servidores de Linux / Windows saltarán estas alarmas permanentemente.

## 6. Billeteras de Criptomonedas (`detectarCryptoBilleteras`)
* **Qué detecta**: Direcciones comunes receptoras de carteras en la Blockchain, como BTC Legacy, P2SH, o direcciones nativas de la Mainnet de Ethereum (`0x...`).
* **Propósito**: Reducir sustancialmente el porcentaje de Spam y Scams. Generalmente son enviados de forma masiva buscando dinero o promocionando obsequios falsos (Giveaways).
* **Falsos positivos**: **MEDIO**. Al tratarse de cadenas y diccionarios hash, detectarlo confunde en ciertas fracciones a identificaciones UUID, claves secretas, hashes largos de Git, o identificadores autogenerados que comiencen o empalmen dichas configuraciones.

## 7. Direcciones IP (`detectarDireccionesIP`)
* **Qué detecta**: Direcciones formato IPv4 convencionales tanto locales como de carácter público.
* **Propósito**: Ocultar posibles redes para prevenir de que un contacto ataque en DDos a la víctima, comparta nodos sospechosos o encubrir "Doxxeo" a servidores privados.
* **Falsos positivos**: **MEDIO**. Es normal en la industria conversar compartiendo números de versión complejas (ej. versión `1.45.2.112`) que se asemejen perfectamente sintácticamente a resoluciones IP.

## 8. Homoglifos (`detectarHomoglifos`)
* **Qué detecta**: Nombres y fragmentos donde un usuario mezcla sin espacio letras que son idénticamente visuales pero de otros conjuntos UTF-8, típicamente alfabeto Latino fusionado con el Cirílico o Griego.
* **Propósito**: Prevenir ataques de suplantación. Ejemplo: registrar la palabra `pаypal.com` (donde internamente la 'a' es en realidad otro carácter distinto) para engañar al cerebro del usuario a clicar algo aparentemente sano.
* **Falsos positivos**: **MUY BAJO**. Típicamente no hay motivo tipográfico ni lingüístico habitual en un usuario genérico en el que cruce o cambie su dialecto y teclado en el espacio de una misma palabra sin mediar espacio para unirla.

---

> 💡 **BUENAS PRÁCTICAS PARA DESARROLLADORES**: 
> Dado que el nivel de falsos positivos en funciones concretas como `detectarCodigo` y `detectarComandosTerminal` es elevado para contextos de IT, se aconseja estructurar el modelo de seguridad de `Ravage` de forma que los filtros de bajo nivel de falsos positivos originen la **Eliminación y Descarte Crítico** del mensaje, mientras que aquellos escáneres propensos al engaño deriven en una advertencia en el cliente (UI Warning) informando sobre la precaución sin bloquear el hilo.
