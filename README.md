# Guido's · Automatización de pedidos

Sistema operativo de delivery para **Guido's**: un bot de WhatsApp en **n8n**
toma los pedidos, **Supabase** los guarda y gobierna, y este repositorio es la
**capa humana** — el panel de cocina del staff y la app de reparto del
motorizado, en una sola URL, con la vista decidida por el rol de quien entra.

> **Una sola URL, un solo login.**
> `staff@guidos.pe` entra → ve el **panel de cocina**.
> `motorizado@guidos.pe` entra → ve **solo sus entregas**.

---

## 🔑 Acceso demo

Dos cuentas de demostración para recorrer el sistema sin pedir acceso. Se entra
por la **misma URL y el mismo formulario**: lo único que cambia es la vista, y la
decide el rol.

| Rol | Correo | Contraseña | Qué se ve al entrar |
|-----|--------|------------|---------------------|
| **Staff · cocina** | `demo.staff@guidos.pe` | `GuidosDemo2026!` | Panel en vivo: pedidos con semáforo por tiempo, KPIs del día, carta editable, historial y clientes. |
| **Reparto · motorizado** | `demo.reparto@guidos.pe` | `GuidosDemo2026!` | Solo las entregas en camino: mapa, monto a cobrar, vuelto y confirmación por código de 5 dígitos. |

> 📱 La vista de reparto está diseñada para el celular. Ábrela en un móvil o en
> el modo responsive del navegador (≤ 480 px de ancho) para verla como es.

<details>
<summary><b>Crear estas dos cuentas (una sola vez, lo hace el administrador)</b></summary>

1. **Supabase → Authentication → Users → Add user**, con **Auto Confirm User**
   marcado, para cada uno de los dos correos.

2. Asignarles el rol en `staff_roles`, que es la tabla que gobierna la RLS:

   ```sql
   insert into public.staff_roles (user_id, rol)
   select id, 'staff' from auth.users where lower(email) = 'demo.staff@guidos.pe'
   on conflict (user_id) do update set rol = excluded.rol;

   insert into public.staff_roles (user_id, rol)
   select id, 'reparto' from auth.users where lower(email) = 'demo.reparto@guidos.pe'
   on conflict (user_id) do update set rol = excluded.rol;
   ```

3. En el código no hay nada que tocar: los dos correos ya están declarados en
   `ROLES_POR_EMAIL`, dentro de [`js/config.js`](js/config.js).

</details>

> ⚠️ **`demo.staff` tiene exactamente los mismos permisos que el staff real:**
> puede aceptar y cancelar pedidos, cambiar precios y marcar plantones. Si la
> demo va a ser pública, apúntala a un **proyecto de Supabase aparte con datos de
> prueba** en vez de a producción (ver [§10](#10-estado-actual-y-siguientes-pasos)).

---

## Índice

0. [🔑 Acceso demo](#-acceso-demo)
1. [La problemática](#1-la-problemática)
2. [Cómo la encontramos](#2-cómo-la-encontramos)
3. [Cómo la resolvimos](#3-cómo-la-resolvimos)
4. [n8n: la automatización que quitó el trabajo repetitivo](#4-n8n-la-automatización-que-quitó-el-trabajo-repetitivo)
5. [Tecnologías usadas y por qué](#5-tecnologías-usadas-y-por-qué)
6. [Arquitectura del repositorio](#6-arquitectura-del-repositorio)
7. [Puesta en marcha](#7-puesta-en-marcha)
8. [Despliegue](#8-despliegue)
9. [Seguridad](#9-seguridad)
10. [Estado actual y siguientes pasos](#10-estado-actual-y-siguientes-pasos)

---

## 1. La problemática

Guido's vendía por WhatsApp. El canal funcionaba —los clientes escribían y
pedían—, pero **todo lo que pasaba después del mensaje era manual**, y ahí se
perdía el dinero y la paciencia. Estas fueron las deficiencias concretas:

| # | Deficiencia | Qué costaba en la práctica |
|---|-------------|----------------------------|
| **D1** | **El pedido vivía en el chat.** No había un estado formal: cocina se enteraba porque alguien gritaba, y el reparto porque alguien le pasaba el celular. | Pedidos olvidados en la cola, pedidos preparados dos veces, y cero forma de responder "¿cuánto falta?" sin leer 40 mensajes hacia arriba. |
| **D2** | **Verificar el pago era un cuello de botella.** Yape/Plin llegaban como captura de pantalla. Alguien tenía que abrir la imagen, leer el monto y el número de operación, y compararlo a ojo. | Minutos muertos por pedido en la hora pico, y el riesgo real de aceptar un voucher de S/ 12 para un pedido de S/ 42. |
| **D3** | **Nadie sabía cuánto llevaba esperando un pedido.** El tiempo solo existía en la cabeza de quien lo estaba atendiendo. | Un pedido podía llevar 50 minutos en cocina sin que nadie lo notara hasta que el cliente reclamaba. |
| **D4** | **"Entregado" era la palabra del motorizado.** No había prueba de que el pedido llegara a las manos del cliente. | Disputas imposibles de resolver: el cliente decía que no le llegó, el motorizado decía que sí. Sin árbitro. |
| **D5** | **Los plantones no dejaban rastro.** El cliente que pedía contra entrega y no abría la puerta volvía a pedir la semana siguiente como si nada. | Se repetía la pérdida —comida, combustible y una hora del motorizado— con el mismo cliente, una y otra vez. |
| **D6** | **Cero visión del negocio.** Ventas del día, ticket promedio, cuánto se vende por Yape vs. efectivo: nada de eso existía en ningún lado. | Decisiones de compra y de carta tomadas por intuición. |
| **D7** | **El motorizado usaba la misma pantalla que la cocina.** Una interfaz de escritorio, densa, en un celular, con una mano, en la calle y a pleno sol. | Toques erróneos y lentitud justo en el momento en que el cliente está esperando en la puerta. |

---

## 2. Cómo la encontramos

No partimos de una idea, partimos de **mirar la operación**. El método fue este:

**a) Acompañamiento en hora pico.** Nos ubicamos en el local durante el turno de
mayor carga —que es cuando los procesos se rompen— y cronometramos el ciclo real
de un pedido: *mensaje del cliente → voucher → confirmación → cocina → salida →
entrega*. Ahí saltaron **D2** y **D3**: el tiempo no se iba cocinando, se iba
esperando a que alguien mirara una captura de pantalla.

**b) Lectura del historial de WhatsApp.** Revisando conversaciones pasadas
aparecieron los patrones repetidos: *"¿ya salió mi pedido?"*, *"te mandé el
yape"*, *"nadie me abrió"*. Cada pregunta frecuente del cliente es un síntoma de
información que el sistema no estaba dando solo (**D1**, **D4**).

**c) Entrevistas por rol.** Cocina y reparto describieron problemas **distintos**.
Cocina pedía prioridad y tiempos; el motorizado pedía dirección, mapa y monto a
cobrar, y nada más. Eso fue lo que descartó la idea de "una pantalla para todos"
(**D7**).

**d) Auditoría de los datos.** Al revisar la base se vio que la información para
medir **ya existía** (montos, métodos de pago, marcas de tiempo) pero **nadie la
consultaba**. El problema no era falta de datos: era falta de una vista (**D6**).

**e) Trazabilidad del dinero perdido.** Al cruzar pedidos cancelados con clientes
se vio que **los plantones se concentraban en unos pocos números** que reincidían
(**D5**).

> **Conclusión del diagnóstico:** el problema no era el canal de WhatsApp — era
> que **el estado del pedido no existía en ningún sistema**. Todo lo demás
> (tiempos, disputas, plantones, ceguera de negocio) era consecuencia de eso.

---

## 3. Cómo la resolvimos

La decisión de fondo: **el pedido deja de ser un chat y pasa a ser una fila en
una base de datos con una máquina de estados**. Todo lo demás cuelga de ahí.

### 3.1 Una máquina de estados como única verdad

```
esperando_pago ──▶ pago_en_revision ──▶ en_cocina ──▶ en_camino ──▶ entregado
      │                   │                 │             │
      └───────▶ cancelado ◀─────────────────┘             └──▶ cancelado
                (rechazado por el local)                       (plantón)
```

La regla que sostiene todo el sistema: **nadie cambia un estado a mano.** Ni el
panel ni la app de reparto hacen `UPDATE` sobre `orders.estado`. Toda transición
pasa por una única función en la base de datos, `accion_staff(p_accion, p_numero,
p_actor)`, que:

- **valida el estado de origen** — no se puede marcar "entregado" algo que nunca
  salió en camino; devuelve `{ ok: false, mensaje: "#123 no está en camino" }`;
- **hace los efectos colaterales en la misma transacción** — al entregar sube
  `pedidos_ok` del cliente; al registrar un plantón sube `plantones` y activa
  `solo_prepago`;
- **devuelve el mensaje que el humano ve en pantalla**, así el texto no se
  duplica en el frontend.

> Resuelve **D1**: el estado es único, consultable y no depende de que alguien
> recuerde algo.

### 3.2 Panel de cocina en vivo (tipo KDS) — resuelve D1, D3, D6

- **Tiempo real** vía Supabase Realtime sobre `orders`, con **refresco de respaldo
  cada 20 s** por si el WebSocket se cae.
- **Semáforo por antigüedad** en cada tarjeta: verde → ámbar → **rojo con pulso**.
  Los umbrales no están quemados en el código: se leen de `guidos_config`
  (`wd_*_alerta_min` / `wd_*_urgente_min`), así el local los ajusta sin tocar
  nada. Si falta alguno, cae al respaldo de `js/config.js`.
- **Aviso activo**: sonido generado con WebAudio (sin archivos que cargar) +
  parpadeo del título de la pestaña cuando entra un pedido nuevo o un voucher por
  revisar. Botón 🔔/🔕 para silenciar, recordado en el navegador.
- **KPIs del día calculados en SQL, no en el navegador** (vista
  `panel_kpis_hoy`): ventas, ticket promedio, reparto Yape/Plin/efectivo y
  tiempo medio de verificación de pago.
- **Carta editable**: marcar un plato como agotado o cambiar su precio desde el
  panel, sin entrar a la base de datos.

### 3.3 Código de entrega de 5 dígitos (modelo Rappi) — resuelve D4

Cuando el pedido pasa a `en_camino`, el cliente recibe por WhatsApp un **código
de 5 dígitos**. Al llegar, el motorizado **no puede marcar "entregado" sin ese
código**: la app le abre un modal, el cliente se lo dicta, y la validación real
la hace el servidor dentro de `accion_staff`.

El staff ve el mismo código en la tarjeta del panel (`🔐 12345`) para poder
ayudar por teléfono si el cliente no lo encuentra.

> Cambia la naturaleza del problema: la entrega deja de ser la palabra de una de
> las partes y pasa a ser un hecho verificable.

### 3.4 App de reparto separada, diseñada para la calle — resuelve D7

Misma URL y mismo login, pero al entrar un usuario con rol `reparto` se monta
otra aplicación: oscura, de alto contraste y con objetivos táctiles grandes.
La tarjeta de entrega está ordenada por **lo que el motorizado necesita, en ese
orden exacto**:

`#Número` gigante + cronómetro → **bloque de cobro** con semáforo (🟢 pagado, no
cobrar · 🟡 cobrar efectivo, con el **vuelto en tipografía gigante**) → **franja
roja** si el cliente agregó algo al pedido → dirección grande → **🗺 botón gigante
a Google Maps** → **📞 Llamar / 💬 WhatsApp** → items colapsables → **✔️ ENTREGADO**
(pide el código) y **⚠️ Nadie respondió** (rojo, separado, con doble confirmación).

Los módulos de cada app se cargan **de forma perezosa**: el motorizado nunca
descarga el código del panel de cocina. La hoja `css/reparto.css` se agrega y
retira dinámicamente, así los estilos de las dos apps no se mezclan.

### 3.5 Memoria de plantones — resuelve D5

`⚠️ Nadie respondió` cancela el pedido, incrementa `plantones` del cliente y lo
marca `solo_prepago = true`. A partir de ahí ese número **solo puede pedir con
pago adelantado**. El staff puede perdonarlo desde la pestaña de clientes.

### 3.6 Separación dura por rol (no solo de interfaz)

La primera versión enrutaba por rol **en el frontend**, lo cual es cosmético:
cualquiera con la sesión abierta podía, técnicamente, consultar las mismas
vistas. La migración de roles cerró ese hueco con **RLS en Postgres**:

- tabla `staff_roles` (usuario → rol) con RLS activa y **sin políticas** para
  `authenticated`: el navegador no la puede leer, solo las funciones
  `security definer`;
- helpers `mi_rol()` y `es_staff()`;
- políticas por tabla: el rol `reparto` **solo lee pedidos en `en_camino`** (más
  los entregados de hoy, para su contador). No ve la carta, ni la configuración,
  ni la lista de clientes;
- `accion_staff` blindada: si la llama un usuario con rol `reparto`, solo acepta
  `'entregado'` y `'planton'`.

Aunque alguien manipule el JavaScript, **la base de datos no le devuelve datos
que no le tocan**.

---

## 4. n8n: la automatización que quitó el trabajo repetitivo

n8n es el **cerebro automático** del sistema: es lo que hace que el pedido exista
sin que nadie lo escriba, y que el cliente esté informado sin que nadie le
responda. Corre fuera de este repositorio y se conecta a la misma base de datos
de Supabase usando la clave `service_role`.

### 4.1 Toma de pedidos por WhatsApp

El flujo escucha los mensajes entrantes, conversa con el cliente y **al cerrar el
pedido lo escribe directamente en Supabase**: crea o reutiliza el `customer`, y
graba la orden en `orders` + `order_items` con dirección, coordenadas, zona,
`delivery_fee`, subtotal y total ya calculados.

> **Lo que optimiza:** elimina la transcripción manual del chat a un cuaderno o a
> un sistema. El pedido nace ya estructurado, con número propio, y **aparece solo**
> en el panel de cocina por Realtime — sin que nadie apriete nada. Es la
> automatización que ataca directamente **D1**.

### 4.2 Validación de vouchers Yape / Plin

Cuando el cliente manda la captura del pago, n8n la procesa y **extrae el monto y
el número de operación**, que quedan guardados en `pago_monto_detectado` y
`pago_operacion`. El pedido pasa a `pago_en_revision` y llega al panel con esos
datos **ya leídos y contrastados contra el total**.

> **Lo que optimiza:** el trabajo del staff pasa de *"abrir la imagen, leer,
> comparar, decidir"* a **un solo toque de confirmar o rechazar**. Es la mejora
> más grande en tiempo de la hora pico, y la que ataca **D2**.
>
> Decisión de diseño deliberada: **n8n lee, el humano aprueba.** El dinero no se
> confirma solo — la automatización prepara la decisión, no la toma. Si el staff
> rechaza el voucher, `accion_staff` limpia `pago_monto_detectado` y
> `pago_operacion` y devuelve el pedido a `esperando_pago`, y n8n le pide otra
> captura al cliente.

### 4.3 Notificaciones automáticas al cliente por cada estado

Cada transición dispara un mensaje de WhatsApp al cliente: pedido aceptado, en
cocina, **en camino (con el código de entrega de 5 dígitos)**, entregado o
rechazado. El staff no escribe ninguno de esos mensajes.

> **Lo que optimiza:** mata la pregunta *"¿ya salió mi pedido?"* antes de que se
> escriba. El local deja de gastar atención en responder estados, y el cliente
> deja de sentir que su pedido cayó en un vacío. Además es el canal por el que
> viaja el código de entrega, así que **habilita D4**.

### 4.4 Cómo conviven n8n y el panel sin pisarse

```
   Cliente (WhatsApp)
          │
          ▼
   ┌─────────────┐    service_role    ┌────────────────────┐
   │     n8n     │ ─────────────────▶ │      Supabase      │
   │  (bot 24/7) │ ◀───────────────── │  Postgres + RLS +  │
   └─────────────┘   notificaciones   │      Realtime      │
                                      └────────────────────┘
                                          ▲             │
                              anon key +  │             │ Realtime
                              RLS por rol │             ▼
                                      ┌────────────────────┐
                                      │  Este repositorio  │
                                      │  Panel  ·  Reparto │
                                      └────────────────────┘
```

Las dos mitades **comparten la base de datos, no el código**, y se coordinan por
dos contratos: la tabla `orders` y la función `accion_staff`.

Detalle importante de diseño: **n8n usa `service_role`, que ignora la RLS**. Por
eso activar toda la seguridad por rol (§3.6) no lo afecta. Y como el bot llama
`accion_staff` sin `auth.uid()`, el control de rol dentro de la función **se salta
solo para él**, y el bot conserva la capacidad de ejecutar cualquier acción.

---

## 5. Tecnologías usadas y por qué

| Capa | Tecnología | Por qué esta y no otra |
|------|-----------|------------------------|
| **Automatización** | **n8n** | Flujos visuales, autoalojable y con nodos listos para WhatsApp y Postgres. El local puede ver y ajustar la lógica del bot sin leer código. |
| **Base de datos** | **Supabase (PostgreSQL)** | Postgres de verdad —vistas, RLS, funciones `plpgsql`— más Auth y Realtime en el mismo servicio. La seguridad vive en la base, no en el cliente. |
| **Tiempo real** | **Supabase Realtime** (WebSocket) | El panel se entera del pedido nuevo en el instante, sin refrescar. Con refresco de respaldo por si el socket cae. |
| **Autenticación** | **Supabase Auth** | Sesión persistente y refresco de token automático. Sin registro público: las cuentas las crea el administrador. |
| **Frontend** | **HTML + CSS + JavaScript vanilla modular (ES Modules)** | **Sin build step, a propósito.** Un negocio de comida no debería necesitar un pipeline de Node para cambiar un texto: se edita un archivo, se hace push y está en producción. Además, cero dependencias es cero superficie de ataque por paquetes. |
| **Cliente de datos** | **supabase-js v2** (CDN) | Único paquete externo. Vía CDN, permitido explícitamente por el CSP. |
| **Tipografía** | **Anton + Barlow** (Google Fonts) | Anton para los números de pedido —legibles a distancia en la cocina—, Barlow para el resto. |
| **Hosting** | **Vercel** (principal) · **Docker + nginx** (Coolify, alternativo) | Vercel: deploy en cada push, HTTPS y CDN sin administrar servidor. La imagen Docker se mantiene para poder autoalojar. |
| **Control de versiones** | **Git + GitHub** | Auto-deploy en cada push a `main`. |

---

## 6. Arquitectura del repositorio

Sin build y sin carpetas duplicadas: **ambas vistas comparten `css/`, `js/` e
`img/`**.

```
Automatizacion_Guidos/
├── index.html                  # login único + shells de ambas vistas
├── reparto.html                # legado: redirige a / (la vista la decide el rol)
│
├── css/
│   ├── styles.css              # panel del staff
│   └── reparto.css             # vista del reparto (se carga por rol)
├── img/
│   └── logo-guidos.png         # logo de marca + favicon
│
├── js/
│   ├── config.js               # SUPABASE_URL + ANON_KEY + ROLES_POR_EMAIL + umbrales
│   ├── supabase.js             # cliente Supabase (compartido)
│   ├── auth.js                 # login / logout / sesión (compartido)
│   ├── roles.js                # rolDeSesion(session) → "staff" | "reparto"
│   ├── session-router.js       # ENTRADA: login único y montaje por rol
│   │
│   ├── app.js                  # ── STAFF: orquestador del panel
│   ├── data.js                 #    lecturas por vistas + RPC
│   ├── render.js               #    HTML de tarjetas, KPIs, carta, historial
│   ├── actions.js              #    acciones del staff (confirmaciones + RPC)
│   ├── realtime.js             #    suscripción a `orders`
│   ├── ui.js                   #    toasts, modal, sonido, timers, semáforo
│   │
│   ├── reparto-app.js          # ── REPARTO: vista del motorizado + código de entrega
│   ├── reparto-data.js         #    en_camino + contador + realtime + accion_staff
│   └── reparto-render.js       #    tarjeta de entrega (escapa texto de WhatsApp)
│
├── vercel.json                 # despliegue en Vercel: headers, CSP, caché, redirects
├── package.json                # scripts de desarrollo local (sin dependencias de runtime)
├── Dockerfile · nginx.conf     # despliegue alternativo autoalojado (Coolify)
└── README.md
```

### Flujo de arranque

```
index.html
 └─ js/session-router.js          ← login único, escucha la sesión y lee el rol
      ├─ rol "staff"   → import("./app.js")          + css/styles.css
      └─ rol "reparto" → import("./reparto-app.js")  + css/reparto.css (dinámica)
```

El rol se resuelve en `js/roles.js` en este orden: (1) `user_metadata.role` en
Supabase Auth; (2) el mapa `ROLES_POR_EMAIL` de `js/config.js`; (3) el **rol de
menor privilegio** (`reparto`), para que una cuenta nueva nunca vea el panel del
staff por error.

---

## 7. Puesta en marcha

### 7.1 Configurar `js/config.js`

En Supabase → **Project Settings → API**, copia la URL y la clave pública:

```js
export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";   // anon / publishable
export const REFRESH_MS = 20000;
```

> ⚠️ **Solo la clave `anon` / publishable.** **Nunca** la `service_role`: quedaría
> expuesta en el navegador con acceso total a la base de datos. La `service_role`
> vive únicamente en n8n. Ningún otro archivo debe contener credenciales.

### 7.2 El esquema de la base de datos

> Las migraciones SQL **no viven en este repositorio**: se aplican directamente
> en el SQL Editor de Supabase y se mantienen fuera del código público. Este
> repositorio contiene únicamente el frontend. Lo que sigue documenta **qué debe
> existir en la base** para que el panel funcione.

El proyecto de Supabase debe tener, además de las tablas base (`orders`,
`order_items`, `customers`, `menu_items`, `menu_categories`, `guidos_config`):

**Migración del panel** — las vistas `security_invoker` que consume el frontend
(`panel_pedidos`, `panel_historial`, `panel_kpis_hoy`, `panel_menu`,
`panel_clientes`, `panel_config`), la RLS de solo lectura para `authenticated`,
el `grant execute` de `accion_staff` y la publicación Realtime de `orders`.
**Nada** queda accesible para el rol `anon`.

**Migración de roles** — la separación dura descrita en [§3.6](#36-separación-dura-por-rol-no-solo-de-interfaz):
tabla `staff_roles`, helpers `mi_rol()` / `es_staff()`, políticas por tabla y el
blindaje por rol dentro de `accion_staff`.

**Migración del código de entrega** — la columna `orders.codigo_entrega` y el
parámetro `p_codigo` de `accion_staff`, que valida el código en el servidor.

Requisitos que asumen esas migraciones:

- `accion_staff` es **SECURITY DEFINER** (así el staff la ejecuta sin necesitar
  `UPDATE` sobre `orders`). Verifícalo:
  ```sql
  select prosecdef from pg_proc where proname = 'accion_staff';  -- debe dar true
  ```
- El bot de n8n usa la clave **`service_role`**, que ignora RLS. Confírmalo antes
  de activar las políticas.

### 7.3 Crear los usuarios

Supabase → **Authentication → Users → Add user**, marcando **Auto Confirm User**.
No hay registro público: el login solo acepta cuentas creadas aquí.

Luego asigna el rol, en los dos lugares:

```js
// A) js/config.js — decide QUÉ VE el usuario
export const ROLES_POR_EMAIL = {
  "staff@guidos.pe": "staff",
  "motorizado@guidos.pe": "reparto",
};
```

```sql
-- B) Supabase — decide QUÉ DATOS puede leer (RLS del punto 3.6)
insert into public.staff_roles (user_id, rol)
select id, 'reparto' from auth.users where lower(email) = 'motorizado2@guidos.pe'
on conflict (user_id) do update set rol = excluded.rol;
```

> Alternativa a (A): en Supabase → Authentication → el usuario → *User metadata*,
> agrega `{ "role": "reparto" }` y no hace falta tocar el código.

### 7.4 Correr en local

```bash
npm install     # opcional: solo instala el servidor estático de desarrollo
npm run dev     # http://localhost:5173

# Alternativas sin Node:
python -m http.server 5173
# o probando la imagen de producción:
docker build -t guidos-web . && docker run --rm -p 8080:80 guidos-web
```

> Debe servirse por HTTP, **no** abriendo `index.html` con doble clic: los ES
> Modules no cargan desde `file://`.

---

## 8. Despliegue

### 8.1 Vercel (principal)

El repositorio ya trae `vercel.json` configurado. **No hay build**: Vercel
publica los archivos tal cual.

1. **Importa el repo** en [vercel.com/new](https://vercel.com/new) →
   `HebertCG/Automatizacion_Guidos`.
2. **Framework Preset: `Other`.** Deja Build Command e Install Command vacíos
   (`vercel.json` ya los anula con `null`).
3. **Deploy.** Cada push a `main` redespliega solo.

O desde la terminal:

```bash
npm install
npx vercel login
npx vercel deploy --prod
```

**Qué hace `vercel.json`** — replica el comportamiento del nginx que ya estaba en
producción:

- **Cabeceras de seguridad**: CSP, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy` y HSTS.
- **CSP**: permite `cdn.jsdelivr.net` (supabase-js), Google Fonts y
  `https://*.supabase.co` + `wss://*.supabase.co` — este último es
  **imprescindible para Realtime**.
- **Caché**: `js/` y `css/` se **revalidan siempre** (`max-age=0,
  must-revalidate`), para que tras un deploy no queden módulos viejos en caché
  rompiendo los imports entre archivos. `img/` sí se cachea (1 h).
- **Redirect**: `/reparto.html` → `/`, porque la vista ya la decide el rol.

**Dominio propio:** en Vercel → *Settings → Domains*, agrega el dominio y apunta
el DNS a los registros que indique. Con Vercel **no** aplica la restricción de
proxy de Cloudflare que sí afectaba al despliegue autoalojado.

### 8.2 Docker + nginx en Coolify (alternativo)

Se mantiene para autoalojar en un VPS:

1. Coolify → **New Resource → Application → Public/Private Repository**.
2. **Build Pack: Dockerfile.** Puerto expuesto: **80**.
3. En **Domains**, agrega el dominio; Coolify emite el certificado Let's Encrypt.
4. En Cloudflare → DNS: registro **A** hacia la IP del VPS con **Proxy status:
   DNS only** (nube gris). Con el proxy naranja, el WebSocket de Realtime y el
   challenge de Let's Encrypt suelen fallar.

> Si Realtime no conecta después de poner el dominio, casi siempre es Cloudflare
> en modo proxy: cámbialo a **DNS only**.

---

## 9. Seguridad

- En el navegador viaja **solo la anon key**. La `service_role` vive únicamente
  en n8n, fuera de este repositorio.
- **Separación dura por rol con RLS** en Postgres: el rol `reparto` no puede leer
  carta, configuración ni clientes aunque manipule el frontend, y solo puede
  ejecutar `'entregado'` y `'planton'`.
- **Ninguna escritura directa de estado.** El frontend nunca hace `UPDATE` sobre
  `orders.estado`; solo existen `UPDATE` acotados en `menu_items`
  (`is_available`, `price`) y `customers` (`solo_prepago`), y solo para staff.
- **XSS:** todo texto dinámico viene de WhatsApp, es decir, **entrada no
  confiable**. Nombres, direcciones y notas pasan por `esc()` antes de tocar el
  DOM; los enlaces a Maps, `tel:` y `wa.me` se construyen solo con dígitos o con
  `encodeURIComponent`.
- **Rol por defecto de menor privilegio:** una cuenta sin rol asignado cae en
  `reparto`, nunca en `staff`.
- **CSP estricta** con `object-src 'none'`, `frame-ancestors 'none'` y
  `base-uri 'self'`, aplicada tanto en Vercel como en nginx.
- **Sin registro público.** Las cuentas las crea el administrador en Supabase.

---

## 10. Estado actual y siguientes pasos

**Limitaciones conocidas, dichas con honestidad:**

- **Métricas de tiempo aproximadas.** `⏱ Verif. pago` es exacto. `⏱ Cocina` y
  `⏱ Reparto` son aproximaciones calculadas desde `estado_desde` y
  `pago_verificado_at`, porque el esquema **no guarda un historial de
  transiciones**. Para promedios históricos precisos haría falta una tabla que
  registre cada cambio de estado.
- **El esquema de la base no está versionado aquí.** Las migraciones se aplican a
  mano en el SQL Editor de Supabase y se mantienen fuera del repositorio público
  ([§7.2](#72-el-esquema-de-la-base-de-datos)). Es una decisión deliberada, pero
  tiene un costo: **el despliegue no es reproducible desde cero** desde este
  repositorio. Lo correcto a futuro es llevarlas en un repositorio privado o con
  `supabase migration`.
- **Los flujos de n8n viven fuera de este repositorio.** Conviene exportar los
  workflows a JSON y versionarlos, aunque sea en privado.
- **La demo comparte base con producción.** Las cuentas `demo.*` operan sobre los
  datos reales, así que `demo.staff` puede cancelar pedidos de verdad. Lo sano es
  un **proyecto de Supabase aparte, con datos sembrados de prueba**, y publicar
  esa URL como demo.

**Siguientes pasos naturales:** tabla de historial de transiciones (habilita
métricas reales y auditoría), entorno de demo aislado, asignación de pedidos a un
motorizado concreto cuando haya más de uno, y un reporte de cierre de caja
diario.

---

*Guido's · Sistema de automatización de pedidos y reparto.*
