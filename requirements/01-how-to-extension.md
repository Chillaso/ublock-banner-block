# Guía para que generes una extensión de Chrome (Manifest V3)

Actúa como un desarrollador experto en extensiones de Chrome (Manifest V3). Tu tarea es crear **una guía técnica paso a paso + el código completo** de una extensión de Chrome sencilla pero funcional.

## 1. Objetivo de la extensión

- Define en 1–2 frases qué hace la extensión (ejemplo: “cambiar el color de fondo de la pestaña activa al pulsar un botón del popup”).[^2][^1]
- Especifica si tendrá:
    - Popup (UI al hacer clic en el icono de la extensión).[^3][^1]
    - Content scripts (código que se inyecta en páginas web).[^4][^2]
    - Background service worker (lógica en segundo plano, eventos).[^5][^3]

Pídete a ti mismo que describas brevemente el flujo de uso.

## 2. Estructura de archivos del proyecto

Genera una estructura mínima de carpeta, por ejemplo:[^6][^1][^2][^3]

- `manifest.json`
- `popup.html`
- `popup.js`
- `content.js` (si se usa)
- `background.js` o `service_worker.js` (si se usa Manifest V3 background).[^3][^5]
- `icon.png` (puede ser un placeholder, indica tamaño 16/48/128).[^3]

Muestra esta estructura como árbol de directorios en texto.

## 3. Archivo manifest.json (Manifest V3)

Genera un `manifest.json` válido para Manifest V3, con comentarios explicativos línea a línea.[^1][^2][^3]
Incluye al menos:

- `"manifest_version": 3`
- `"name"`, `"description"`, `"version"`
- `"action"` con:
    - `"default_popup": "popup.html"`
    - `"default_icon": "icon.png"`.[^1][^3]
- `"permissions"` necesarias (ej. `"activeTab"`, `"scripting"`, según el objetivo).[^4][^3]
- `"icons"` con tamaños 16, 48, 128.[^3]
- Si se usa background:
    - `"background": { "service_worker": "background.js", "type": "module" }`.[^5][^3]
- Si se usan content scripts:
    - `"content_scripts"` con `"matches"` y `"js"` apropiados.[^2][^4]

Pide que valides que el manifest es compatible con la documentación oficial de Chrome Extensions (Manifest V3).[^5][^3]

## 4. Código del popup (UI)

Genera:

1. `popup.html` con:
    - Estructura básica HTML5.
    - Un botón claro (ej. “Cambiar color de fondo”).
    - Enlace al script `popup.js`.[^2][^1]
2. `popup.js` que:
    - Escuche el clic del botón.
    - Llame a la API adecuada (`chrome.tabs`, `chrome.scripting`, etc.) para cumplir el objetivo.[^4][^2][^3]
    - Maneje errores de forma simple (console.error, mensajes al usuario).

Incluye comentarios que expliquen la relación popup ↔ APIs de Chrome.

## 5. Content script (si aplica)

Si la extensión interactúa con el contenido de la página:

- Crea `content.js` que modifique el DOM (ej. cambiar `document.body.style.backgroundColor`).[^2][^4]
- Explica cómo se inyecta:
    - Automáticamente via `"content_scripts"` en el manifest, o
    - Dinámicamente via `chrome.scripting.executeScript` desde `popup.js`.[^4][^3]

Comenta el código explicando qué partes acceden al DOM y qué no se puede hacer desde el background.

## 6. Background service worker (si aplica)

Si la extensión necesita lógica en segundo plano (alarmas, context menus, eventos de pestañas, etc.):[^5][^3][^4]

- Crea `background.js` como service worker.
- Registra al menos un listener (ej. `chrome.runtime.onInstalled.addListener` o `chrome.action.onClicked.addListener`).[^3][^5]
- Explica cómo este archivo no tiene acceso directo al DOM, pero sí a APIs de Chrome y mensajería.

Incluye un ejemplo de mensajería entre `background.js` y `content.js`/`popup.js` usando `chrome.runtime.sendMessage` y `onMessage`.[^5]

## 7. Carga y prueba de la extensión en Chrome

Incluye instrucciones detalladas, paso a paso, para que el usuario pueda probar la extensión localmente:[^7][^2][^4]

1. Abrir `chrome://extensions/` en Chrome.
2. Activar “Modo desarrollador” (interruptor arriba a la derecha).[^7][^2][^4]
3. Pulsar “Cargar descomprimida” / “Load unpacked”.
4. Seleccionar la carpeta del proyecto donde están el `manifest.json` y demás archivos.[^7][^2][^4]
5. Confirmar que la extensión aparece en la lista y que el icono se ve en la barra de herramientas.[^2][^4]
6. Probar el flujo completo:
    - Hacer clic en el icono.
    - Usar el popup.
    - Ver el efecto en la página / en el navegador.

Pide que se añadan notas sobre cómo ver errores en `chrome://extensions` (botón “Inspeccionar vistas” / “Errors”).[^4]

## 8. Mejores prácticas básicas

Instrúyete para aplicar y comentar brevemente:

- Usar nombres claros de archivos y funciones.
- Minimizar permisos en `manifest.json` (principio de mínimo privilegio).[^3][^4]
- Incluir manejo de errores y logs razonables.
- Comentar el código con orientación didáctica (para alguien que aprende extensiones).
- Mencionar que hay múltiples ejemplos de extensiones en repositorios públicos para referencia (sin copiar código tal cual).[^8][^6]

Opcionalmente, indica enlaces de referencia (solo como texto, no hace falta el contenido completo):

- Documentación oficial de Extensiones de Chrome / Manifest V3.[^5][^3]
- Tutoriales recientes de “Build a Chrome extension using Manifest V3” y “Make your first Chrome extension”.[^1][^2][^4]


## 9. Estilo de respuesta esperado

- Explica cada archivo antes de mostrar el código.
- Muestra el código completo de cada archivo en bloques separados.
- Usa comentarios en el código para que un principiante entienda qué hace cada parte.
- Mantén todo en JavaScript simple + HTML/CSS plano (sin bundlers) salvo que explícitamente se pida otra tecnología.[^6][^5]

Al final, incluye una sección “Siguientes pasos” con sugerencias breves: añadir opciones, publicar en Chrome Web Store, mejorar UI, etc.[^4][^3]

[^1]: https://r44j.dev/blog/build-your-first-chrome-extension-in-60-seconds-a-beginner-s-guide

[^2]: https://www.j-labs.pl/en/tech-blog/make-your-first-chrome-extension/

[^3]: https://www.extensionradar.com/blog/how-to-make-chrome-extension

[^4]: https://www.creolestudios.com/step-by-step-guide-to-chrome-extension-development/

[^5]: http://developerlife.com/2023/08/11/chrome-extension-shortlink/

[^6]: https://github.com/classvsoftware/example-chrome-extension

[^7]: https://victoronsoftware.com/posts/create-chrome-extension/

[^8]: https://github.com/orbitbot/chrome-extensions-examples

[^9]: https://docs.google.com/document/d/1OlzT_DA6bB72elybWNRYO0fh-wdyYHkQgPGMZIP4_xY/mobilebasic

[^10]: https://support.google.com/chrome_webstore/answer/2664769?hl=en

