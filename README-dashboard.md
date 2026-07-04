# Guido's · Panel de pedidos

Vista operativa (tipo KDS) para el personal del local. Muestra en vivo los
pedidos que entran por el bot de WhatsApp, con semáforo por tiempo, KPIs del
día, carta con disponibilidad, e historial/clientes. Todas las transiciones de
estado pasan por la RPC `accion_staff` — el panel **nunca** hace `UPDATE`
directo de `orders.estado`.

Stack: **HTML + CSS + JavaScript vanilla modular** (sin build step) +
**Supabase JS v2** (CDN) + **nginx estático** (Docker / Coolify).

---

## 1. Estructura

```
index.html
css/styles.css
js/
  config.js     ← credenciales (editar aquí)
  supabase.js   ← cliente
  auth.js       ← login/sesión
  data.js       ← lecturas (vistas) y RPC
  realtime.js   ← suscripción a orders
  render.js     ← HTML de tarjetas/KPIs/etc.
  actions.js    ← acciones del staff (accion_staff, carta, clientes)
  ui.js         ← toasts, modal, sonido, timers, semáforo
  app.js        ← orquestador
05-dashboard.sql  ← vistas + RLS + grants (ejecutar en Supabase)
Dockerfile / nginx.conf
```

---

## 2. Configurar `js/config.js`

En Supabase → **Project Settings → API**, copia:

```js
export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";   // anon / publishable
export const REFRESH_MS = 20000;
```

> ⚠️ Solo la clave **anon / publishable** (pública). **Nunca** la
> `service_role`: quedaría expuesta en el navegador con acceso total a la BD.
> Ningún otro archivo debe contener credenciales.

---

## 3. Ejecutar el SQL

Abre **SQL Editor** en Supabase y corre `05-dashboard.sql` completo. Crea:

- Vistas `security_invoker`: `panel_pedidos`, `panel_historial`,
  `panel_kpis_hoy`, `panel_menu`, `panel_clientes`, `panel_config`.
- RLS de **solo lectura** para `authenticated` sobre las tablas base; UPDATE
  acotado a `menu_items(is_available, price)` y `customers(solo_prepago)`.
- `grant execute` de `accion_staff` para `authenticated`.
- Publicación Realtime de `orders`.
- **Nada** queda accesible para `anon`.

Requisitos previos que asume el script:

- `accion_staff(text, bigint, text)` es **SECURITY DEFINER** (así el staff la
  ejecuta sin necesitar UPDATE sobre `orders`). Verifícalo:
  ```sql
  select prosecdef from pg_proc where proname = 'accion_staff';
  -- debe devolver true
  ```
- El bot n8n usa la clave **service_role** (ignora RLS). Confírmalo para que
  activar RLS no le afecte.

---

## 4. Crear usuarios del staff

Supabase → **Authentication → Users → Add user**. Marca **Auto Confirm User**
(así entran sin verificar correo). Repite por cada persona del local. No hay
registro público: el login solo acepta cuentas creadas aquí.

Prueba rápida local: sirve la carpeta con cualquier estático, p. ej.
`npx serve .` o `python -m http.server`, y entra con una cuenta creada.

---

## 5. Desplegar en Coolify

1. Sube esta carpeta a un repo de GitHub.
2. Coolify → **New Resource → Application → Public/Private Repository**,
   apunta al repo y rama.
3. **Build Pack: Dockerfile** (Coolify detecta el `Dockerfile`). Puerto
   expuesto: **80**. Deja `js/config.js` ya editado en el repo (son claves
   públicas, sin riesgo).
4. Deploy. Activa **auto-deploy** para redeploy en cada push.

### Subdominio (ej. `panelguidos.klassia.lat`)

1. En Coolify, en la app → **Domains**: `https://panelguidos.klassia.lat`.
   Coolify emite el certificado Let's Encrypt.
2. En **Cloudflare** → DNS: registro **A** `panelguidos` → IP del VPS,
   **Proxy status: DNS only** (nube gris). Con proxy naranja, el WebSocket de
   Realtime y el challenge de Let's Encrypt suelen fallar.
3. Espera propagación y verifica `https://panelguidos.klassia.lat`.

> Si Realtime no conecta tras el dominio, casi siempre es Cloudflare en modo
> proxy: cámbialo a **DNS only**. La CSP de `nginx.conf` ya permite
> `wss://*.supabase.co`.

---

## 6. Notas de comportamiento

- **Semáforo**: verde → ámbar (umbral `wd_*_alerta_min`) → rojo con pulso
  (`wd_*_urgente_min`), leídos de `guidos_config`. Si falta algún umbral, se usa
  el respaldo de `config.js` (`UMBRALES_DEFAULT`).
- **Notificación**: sonido (WebAudio, sin assets) + parpadeo del título cuando
  entra un pedido nuevo o un voucher por revisar. Botón 🔔/🔕 para silenciar
  (se recuerda en el navegador).
- **KPIs de tiempo**: `⏱ Verif. pago` es exacto; `⏱ Cocina` y `⏱ Reparto` son
  aproximaciones (ver nota en `05-dashboard.sql`) porque el esquema no guarda un
  historial de transiciones y el enunciado prohíbe inventar tablas.
