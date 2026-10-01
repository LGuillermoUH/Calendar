# Requisitos — Gestión de eventos del salón

## Introducción

Aplicación web para gestionar los eventos de un salón de eventos. Ofrece dos experiencias:

- **Vista pública** (sin autenticación): un calendario de solo lectura que permite a cualquier visitante ver qué días están apartados/ocupados, sin exponer datos sensibles.
- **Vista privada** (autenticación con Supabase, solo inicio de sesión — sin registro público): permite al administrador registrar y gestionar eventos y visitas, incluyendo si el día está apartado, el pago, la persona responsable y sus datos de contacto.

La aplicación tiene un **frontend SPA** construido con Vite + React 19 (JavaScript) y un **backend API en ASP.NET Core (.NET)** que concentra la gestión de datos contra la base de datos. La base de datos es **Supabase (Postgres)**. La autenticación usa **Supabase Auth con correo y contraseña** e incluye **registro de usuarios**; el backend .NET valida el token de Supabase en cada petición protegida y comprueba el **rol** del usuario en la base de datos. Solo los usuarios con rol `admin` acceden a la vista privada; un registro nuevo obtiene el rol `viewer` (sin acceso admin) hasta que un administrador lo promueva. Tanto el frontend como el backend se **empaquetan en contenedores Docker** y se orquestan con Docker Compose.

## Glosario

- **Evento / Reserva:** un día (o rango de días) apartado para un cliente, con datos de negocio (pago, persona, contacto).
- **Día apartado:** un día que tiene al menos un evento asociado en estado apartado/confirmado.
- **Administrador:** el usuario autenticado que gestiona los eventos desde la vista privada.
- **Visitante:** cualquier persona que abre la web sin iniciar sesión.

## Requisitos

### Requisito 1 — Vista pública del calendario (solo lectura)

**Historia:** Como visitante, quiero ver un calendario mensual que indique qué días están apartados, para saber la disponibilidad del salón sin necesidad de iniciar sesión.

**Criterios de aceptación:**
1. CUANDO un visitante abre la aplicación sin sesión ENTONCES el sistema DEBE mostrar el calendario del mes actual en modo solo lectura.
2. CUANDO se muestra un mes ENTONCES el sistema DEBE marcar visualmente cada día que tiene uno o más eventos apartados (p. ej. con color o etiqueta "Apartado").
3. CUANDO un visitante hace clic en un día apartado ENTONCES el sistema DEBE mostrar únicamente que el día está apartado, SIN exponer pago, persona ni datos de contacto.
4. CUANDO un visitante hace clic en un día libre ENTONCES el sistema DEBE indicarlo como disponible y NO DEBE ofrecer ninguna acción de edición ni creación.
5. CUANDO el visitante navega a otro mes (anterior/siguiente) ENTONCES el sistema DEBE cargar y mostrar el estado de apartado de ese mes.
6. El sistema NO DEBE renderizar ningún botón de crear, editar o eliminar en la vista pública.
7. Los textos de la interfaz (nombres de días, meses, etiquetas) DEBEN estar en español.

### Requisito 2 — Inicio de sesión (solo login, sin registro)

**Historia:** Como administrador, quiero iniciar sesión mediante un botón superior, para acceder a la gestión privada; y quiero que no exista opción de registro público.

**Criterios de aceptación:**
1. CUANDO cualquier usuario ve la aplicación ENTONCES el sistema DEBE mostrar un botón "Iniciar sesión" en la parte superior.
2. CUANDO un usuario pulsa "Iniciar sesión" ENTONCES el sistema DEBE ofrecer autenticación mediante Supabase Auth solicitando **correo y contraseña**, y DEBE ofrecer también una opción de **registro** (crear cuenta con correo y contraseña).
3. CUANDO un usuario se registra ENTONCES el sistema DEBE crear la cuenta con rol `viewer` por defecto (sin acceso a la vista privada) hasta que un administrador lo promueva a `admin`.
4. CUANDO alguien intenta autenticarse con credenciales inválidas ENTONCES el sistema NO DEBE conceder acceso; y CUANDO un usuario autenticado NO tiene rol `admin` ENTONCES el sistema NO DEBE mostrarle la vista privada y DEBE indicarle que carece de permisos.
5. CUANDO la autenticación es correcta y el usuario es `admin` ENTONCES el sistema DEBE mostrar la vista privada y reemplazar el botón "Iniciar sesión" por un botón "Cerrar sesión".
6. CUANDO el administrador pulsa "Cerrar sesión" ENTONCES el sistema DEBE terminar la sesión y volver a la vista pública.
7. CUANDO el administrador recarga la página con una sesión válida vigente ENTONCES el sistema DEBE mantener la sesión sin pedir credenciales de nuevo.

### Requisito 3 — Protección de la ruta privada

**Historia:** Como propietario del salón, quiero que la gestión solo sea accesible con sesión válida, para que nadie sin autorización vea ni modifique datos de clientes.

**Criterios de aceptación:**
1. CUANDO un usuario sin sesión intenta acceder a la vista privada ENTONCES el sistema DEBE redirigirlo a la vista pública (o al inicio de sesión).
2. CUANDO la sesión expira o se cierra ENTONCES el sistema DEBE dejar de mostrar la vista privada y volver a la pública.
3. CUANDO el frontend llama a un endpoint protegido del backend .NET ENTONCES el backend DEBE validar el token JWT de Supabase y comprobar el rol del usuario en la tabla `profiles`: DEBE rechazar con 401 sin token válido y con 403 si el usuario no tiene rol `admin`.
4. La lectura pública DEBE limitarse a la información mínima de disponibilidad (fecha + estado apartado), sin exponer campos sensibles, y DEBE servirse por un endpoint público del backend que no requiere autenticación.
5. La base de datos DEBE mantener Row Level Security como defensa en profundidad; el backend .NET DEBE usar credenciales de servicio únicamente en el lado servidor y NUNCA exponerlas al cliente.

### Requisito 4 — Registro y gestión de eventos/visitas (vista privada)

**Historia:** Como administrador, quiero registrar eventos o días de visita con sus datos de negocio, para llevar el control interno del salón.

**Criterios de aceptación:**
1. CUANDO el administrador selecciona un día en la vista privada ENTONCES el sistema DEBE permitir crear un nuevo registro para ese día.
2. CUANDO el administrador crea o edita un registro ENTONCES el sistema DEBE capturar como mínimo: fecha, si el día está apartado (sí/no), monto pagado, nombre de la persona y datos de contacto (teléfono y/o correo).
3. CUANDO el administrador crea o edita un registro ENTONCES el sistema DEBE permitir opcionalmente un título/descripción del evento y una nota interna.
4. CUANDO el administrador guarda un registro ENTONCES el sistema DEBE persistirlo llamando al backend .NET (que escribe en Supabase) y reflejar el cambio en el calendario inmediatamente.
5. CUANDO el administrador abre un día con eventos ENTONCES el sistema DEBE obtener del backend .NET y mostrar todos los eventos de ese día con sus datos completos.
6. CUANDO el administrador edita un evento existente ENTONCES el sistema DEBE actualizar el registro vía el backend .NET conservando su identidad.
7. CUANDO el administrador elimina un evento ENTONCES el sistema DEBE pedir confirmación y, al confirmar, borrarlo vía el backend .NET y quitarlo del calendario.
8. CUANDO el monto pagado se introduce ENTONCES el sistema DEBE validar que sea un número no negativo.
9. CUANDO un campo obligatorio (fecha, persona) está vacío al guardar ENTONCES el sistema NO DEBE guardar y DEBE indicar el error.

### Requisito 5 — Estado "apartado" y visibilidad pública

**Historia:** Como administrador, quiero marcar internamente si un día está apartado, para que la disponibilidad se refleje correctamente en la vista pública.

**Criterios de aceptación:**
1. CUANDO un evento se marca como apartado ENTONCES el día correspondiente DEBE aparecer como "Apartado" en la vista pública.
2. CUANDO un evento NO está apartado (p. ej. una visita tentativa) ENTONCES el sistema PUEDE mostrarlo como registrado internamente pero el día PUEDE seguir apareciendo disponible en la vista pública, según su estado.
3. CUANDO todos los eventos apartados de un día se eliminan o se desmarcan ENTONCES el día DEBE volver a mostrarse disponible en la vista pública.

### Requisito 6 — Robustez y experiencia

**Historia:** Como usuario, quiero que la aplicación responda con claridad ante errores y en distintos dispositivos, para confiar en ella.

**Criterios de aceptación:**
1. CUANDO una operación con el backend .NET o Supabase falla (red, permisos) ENTONCES el sistema DEBE mostrar un mensaje de error legible y NO DEBE dejar la interfaz en un estado inconsistente.
2. MIENTRAS se cargan datos del mes ENTONCES el sistema DEBE indicar un estado de carga.
3. La interfaz DEBE ser usable en pantallas de escritorio y móviles (diseño responsivo básico).
4. El frontend solo DEBE conocer la URL del backend .NET y la configuración de Supabase Auth necesaria para el login; las credenciales de servicio de Supabase (service role / cadena de conexión) DEBEN residir únicamente en el backend .NET.

### Requisito 7 — Backend .NET de gestión de datos

**Historia:** Como desarrollador, quiero un backend en ASP.NET Core que concentre el acceso a la base de datos, para tener validación, autorización y reglas de negocio del lado servidor.

**Criterios de aceptación:**
1. El backend DEBE exponer una API REST con endpoints para: disponibilidad pública del mes, listar eventos del mes (protegido), crear, actualizar y eliminar eventos (protegidos).
2. CUANDO el backend recibe una petición a un endpoint protegido ENTONCES DEBE validar el JWT de Supabase (firma y emisor), resolver el rol del usuario en `profiles` y autorizar solo si el rol es `admin`; en caso contrario DEBE responder 401 (sin token) o 403 (sin rol admin).
3. CUANDO el backend recibe datos de un evento ENTONCES DEBE validar del lado servidor: fecha presente, nombre de persona presente, monto ≥ 0; y DEBE responder 400 con detalle si la validación falla.
4. El endpoint de disponibilidad pública DEBE devolver únicamente fecha + estado apartado, sin datos de cliente, y NO DEBE requerir autenticación.
5. El backend DEBE conectarse a Supabase Postgres usando credenciales de servidor leídas de variables de entorno, nunca embebidas en el código.
6. El backend DEBE habilitar CORS para el origen del frontend y exponer un endpoint de salud (`/health`).

### Requisito 8 — Contenerización y despliegue (Docker)

**Historia:** Como responsable del despliegue, quiero que frontend y backend se ejecuten en contenedores Docker, para levantar el sistema de forma reproducible.

**Criterios de aceptación:**
1. DEBE existir un `Dockerfile` para el backend .NET que compile y ejecute la API en una imagen de runtime de .NET.
2. DEBE existir un `Dockerfile` para el frontend que construya la SPA (Vite) y la sirva mediante un servidor estático (p. ej. Nginx) en producción.
3. DEBE existir un `docker-compose.yml` que levante frontend y backend juntos, con las variables de entorno necesarias y el mapeo de puertos.
4. Los `Dockerfile` DEBEN usar builds multi-etapa para minimizar el tamaño de imagen final.
5. Las credenciales (Supabase service key, cadena de conexión) DEBEN inyectarse por variables de entorno / archivo `.env` no versionado, nunca dentro de la imagen.
6. CUANDO se ejecuta `docker compose up` con la configuración correcta ENTONCES el sistema DEBE quedar accesible (frontend sirviendo la SPA y backend respondiendo en su puerto).

## Supuestos (pendientes de confirmar en revisión)

- **Alcance de acceso:** Existe registro público de usuarios (signup con correo y contraseña). Cada usuario tiene un rol en la tabla `profiles` de Postgres (`admin` | `viewer`), con `viewer` por defecto. **Solo los usuarios con rol `admin` acceden a la vista privada**; el backend .NET consulta el rol por el `sub` del JWT y responde 403 si no es admin. Un administrador promueve a otro usuario con `update profiles set role='admin'`.
- **Autenticación del backend:** El backend .NET NO implementa su propio sistema de cuentas; reutiliza y valida el JWT de Supabase (pendiente de confirmación en revisión).
- **Detalle público:** La vista pública muestra solo "Apartado" en días ocupados, sin ningún dato del cliente.
- **Rango de fechas:** Cada evento se asocia a un único día; si se requiere apartar rangos de varios días, se debe indicar para ampliar el modelo.
