# Tareas — Mejoras UI generales del layout

Orden de implementación. Cada tarea es un cambio acotado y verificable en `frontend/`.

## Parte B — Contacto por WhatsApp (usuario público)

- [x] **1. Variables de entorno y documentación.**
  - Añadir `VITE_WHATSAPP_PHONE` y `VITE_WHATSAPP_MESSAGE` a `frontend/.env.example` con comentarios (teléfono en formato internacional solo dígitos; mensaje admite el marcador `{fecha}`).
  - Definir un texto por defecto en español para cuando `VITE_WHATSAPP_MESSAGE` no esté configurado.

- [x] **2. Helper de WhatsApp.**
  - Crear `frontend/src/lib/whatsapp.js` con:
    - `getWhatsAppPhone()` → lee `import.meta.env.VITE_WHATSAPP_PHONE`, normaliza a solo dígitos, devuelve `''` si no hay.
    - `buildWhatsAppMessage(dateKey)` → toma la plantilla de `VITE_WHATSAPP_MESSAGE` (o el default), sustituye `{fecha}` por la fecha en formato legible.
    - `buildWhatsAppUrl(dateKey)` → devuelve `https://wa.me/<phone>?text=<encodeURIComponent(mensaje)>`, o `''` si no hay teléfono.
  - Añadir prueba unitaria `frontend/src/lib/whatsapp.test.js` (sustitución de `{fecha}`, codificación URL, ausencia de teléfono).

- [x] **3. Componente del modal de contacto público.**
  - Crear `frontend/src/components/WhatsAppModal.jsx` reutilizando el patrón de `EventModal.jsx`: overlay `.modal-overlay`, `role="dialog"` `aria-modal="true"`, bloqueo de scroll de fondo, botón de cierre accesible.
  - Contenido: fecha seleccionada, mensaje predeterminado ya redactado visible, botón principal «Enviar WhatsApp» (abre la URL en pestaña nueva, `rel="noopener noreferrer"`) y botón «Cancelar».
  - Si no hay teléfono configurado, mostrar aviso amable en lugar del botón de envío.

- [x] **4. Integrar el modal en el clic público de `Calendar.jsx`.**
  - En `handleDayClick`, para usuario **no** admin: si el día está **disponible** (no reservado), fijar `selectedKey` y abrir el nuevo modo `'whatsapp'`; si está apartado, mantener el comportamiento actual (no abrir modal).
  - Renderizar `WhatsAppModal` cuando `modalMode === 'whatsapp'`; conservar `EventModal` para los modos admin/login.
  - No alterar el flujo de administrador (`add`/`view`) ni el de login.

## Parte A — Consistencia y estética en móvil

- [x] **5. Barra de navegación del calendario responsiva (`app.css`).**
  - En `@media (max-width: 560px)`: permitir que `.calendar-nav` envuelva a segunda fila con `flex-wrap`, ajustar espaciados de `.calendar-nav__right`, `.view-toggle` y `.calendar-today`, y garantizar áreas táctiles cómodas (~40px) sin desbordes.

- [x] **6. Header y pestañas de administrador en móvil (`app.css`).**
  - Ajustar `.app-header` (título + botón de sesión) y `.app-tabs` en la media query móvil para equilibrio y sin recortes ni pegado al borde.

- [x] **7. Modal a ancho completo cómodo en móvil (`app.css`).**
  - En móvil: `.modal` usa el ancho útil con márgenes, mantiene `max-height`/scroll interno, y `.modal-actions` apila botones a ancho completo en pantallas estrechas.

- [x] **8. Pulido de celdas, leyenda y textos de ayuda en móvil (`app.css`).**
  - Revisar espaciado/jerarquía de `.day-cell`, `.day-tag`, `.calendar-legend` y `.hint` en la media query móvil; evitar solapes y recortes de las etiquetas «Apartado»/«Disponible». Solo tokens de tema; respetar modo oscuro y `prefers-reduced-motion`.

## Verificación final

- [x] **9. Verificar.**
  - `npm run lint` sin errores; `npm run test` en verde (incluida la nueva prueba de `whatsapp`).
  - Comprobación manual en viewport móvil (375×667): nav/header/pestañas completos, modal cómodo, flujo público de WhatsApp abre `wa.me` precargado (sin envío automático), día apartado no abre modal, escritorio intacto.
