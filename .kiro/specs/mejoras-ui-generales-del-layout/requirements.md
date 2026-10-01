# Requisitos — Mejoras UI generales del layout

## Objetivo

Pulir el layout del salón de eventos para que se vea consistente y estético en móviles, y darle al usuario público (sin sesión) una acción útil: al tocar una fecha **disponible**, mostrar un modal que le permita abrir WhatsApp con un mensaje predeterminado dirigido a un número configurable por variable de entorno. La app solo **prepara** el mensaje en WhatsApp; nunca lo envía por el usuario.

## Alcance

- Frontend `frontend/` (React 19 + Vite, JavaScript). Se tocan `src/components/` y `src/styles/app.css`.
- No hay cambios de backend ni de base de datos.
- El número de WhatsApp y el texto base del mensaje se leen de variables de entorno `VITE_*` (patrón ya usado por `VITE_API_URL`).

## Parte A — Consistencia y estética en móvil

- **A1.** En pantallas ≤ 560px la barra de navegación del calendario (`.calendar-nav`) no debe desbordar ni apretar los botones: el título, el conmutador Mes/Semana, «Hoy» y las flechas deben acomodarse legibles (envolver a una segunda fila si hace falta), manteniendo áreas táctiles cómodas (mínimo ~40px de alto).
- **A2.** El header de la app (`.app-header`: título + botón de sesión) y las pestañas de administrador (`.app-tabs`) se ven equilibrados en móvil, sin que el botón de sesión quede pegado al borde ni el título se corte.
- **A3.** El modal (`.modal`) usa el ancho disponible en móvil con márgenes cómodos, permite scroll interno cuando el contenido es alto y sus botones de acción (`.modal-actions`) siguen alcanzables (por ejemplo, apilándose a ancho completo en pantallas estrechas).
- **A4.** Las celdas de día, la leyenda y los textos de ayuda mantienen jerarquía y espaciado coherentes en móvil (sin solapes ni recortes de las etiquetas «Apartado»/«Disponible»).
- **A5.** Los cambios son solo de CSS/marcado; se respetan los tokens de tema existentes (variables `--*`), el modo oscuro (`prefers-color-scheme: dark`) y `prefers-reduced-motion`. No se introducen colores fijos fuera de las variables de tema.
- **A6.** El comportamiento y la interfaz de escritorio no cambian: todas las mejoras están acotadas a las media queries móviles o son ajustes que no alteran el aspecto ≥ 561px.

## Parte B — Contacto por WhatsApp para el usuario público

- **B1.** Nuevas variables de entorno en el frontend:
  - `VITE_WHATSAPP_PHONE` — número destino en formato internacional solo dígitos (ej. `521234567890`).
  - `VITE_WHATSAPP_MESSAGE` — mensaje predeterminado (plantilla). Admite el marcador `{fecha}` que se sustituye por la fecha seleccionada; si no se define, se usa un texto por defecto en español.
  - Ambas se documentan en `frontend/.env.example`.
- **B2.** Cuando el usuario **no** tiene sesión (público) y toca un día **disponible** (no apartado), se abre un modal de contacto. Hoy ese clic no hace nada (`if (!isAdmin) return` en `Calendar.jsx`); este es el nuevo comportamiento.
- **B3.** El modal de contacto muestra la fecha elegida, el mensaje predeterminado ya redactado (con la fecha sustituida) y un botón principal «Enviar WhatsApp». Al pulsarlo se abre WhatsApp (`https://wa.me/<phone>?text=<mensaje-url-encoded>`) en una pestaña nueva con el mensaje **precargado**; la app **no** envía el mensaje por el usuario.
- **B4.** El modal permite cerrarse (botón «Cancelar»/«×») y reutiliza el patrón visual del `EventModal` existente (overlay, `role="dialog"`, bloqueo de scroll de fondo, cierre accesible).
- **B5.** Tocar un día **apartado** siendo público **no** abre el modal de contacto (mantiene la vista de solo lectura actual para días no disponibles).
- **B6.** Si `VITE_WHATSAPP_PHONE` no está configurado, el modal no ofrece el envío: muestra un aviso amable de que el contacto no está disponible (o no se abre el modal), sin romper la vista pública.
- **B7.** El comportamiento del administrador (abrir «add»/«view» al tocar un día) no cambia.

## Criterios de aceptación (verificables)

- [ ] En un viewport de 375×667 (móvil), la barra de navegación del calendario, el header y las pestañas se ven completos, sin desbordes horizontales ni recortes.
- [ ] El modal ocupa el ancho útil en móvil, hace scroll interno si es alto y sus botones son alcanzables.
- [ ] Sin sesión, tocar un día disponible abre el modal de WhatsApp con la fecha y el mensaje predeterminado visibles.
- [ ] El botón «Enviar WhatsApp» abre `wa.me` con teléfono y mensaje precargados en pestaña nueva; no se envía nada automáticamente.
- [ ] Sin sesión, tocar un día apartado no abre el modal de contacto.
- [ ] Con `VITE_WHATSAPP_PHONE` vacío, la vista pública sigue funcionando y no ofrece envío roto.
- [ ] `frontend/.env.example` documenta `VITE_WHATSAPP_PHONE` y `VITE_WHATSAPP_MESSAGE`.
- [ ] Modo oscuro, `prefers-reduced-motion` y el aspecto de escritorio se mantienen intactos.
- [ ] `npm run lint` pasa; los tests existentes (`npm run test`) siguen en verde.
