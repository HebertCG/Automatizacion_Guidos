# Guido's · Reparto 🛵 — app de los motorizados

Web app **móvil** para los repartidores de Guido's. Es la vista hermana del
panel del staff (`index.html`): cuando el staff marca un pedido **"en camino"**,
aparece aquí como una entrega del motorizado. Pensada para usarse **en el
celular, en la calle, con una sola mano y a pleno sol**: todo grande, oscuro y
de alto contraste.

## En una frase

`/reparto.html` lista los pedidos en estado `en_camino`, ordenados del más
antiguo al más nuevo, y deja al motorizado: ver **cuánto cobrar y qué vuelto
llevar**, **navegar con Google Maps**, **llamar / escribir por WhatsApp** al
cliente, y **cerrar** la entrega como *entregado* o *plantón*.

## Arquitectura (dentro de este mismo proyecto)

No hay carpeta aparte ni build: ambas apps comparten `css/`, `js/` e `img/`, y
un **solo contenedor** las sirve. Los archivos del reparto están nombrados por
su función (`reparto-*`):

```
panelguidos/
├── index.html                 # app STAFF (panel de pedidos)
├── reparto.html               # app MOTORIZADOS  ← esta
├── css/
│   ├── styles.css             # panel
│   └── reparto.css            # motorizados
├── img/
│   └── logo-guidos.png        # logo de la marca (brand + favicon de ambas)
└── js/
    ├── config.js              # COMPARTIDO: SUPABASE_URL + ANON_KEY (un solo lugar)
    ├── … (módulos del panel)
    ├── reparto-supabase.js    # cliente (storageKey propio → sesión separada del staff)
    ├── reparto-auth.js        # login / logout / sesión
    ├── reparto-data.js        # fetch en_camino + contador + realtime + accion_staff
    ├── reparto-render.js      # tarjeta de entrega (escapa todo texto de WhatsApp)
    └── reparto-app.js         # orquestación + toasts + modal
```

- **Sin framework, sin build.** HTML + CSS + JS vanilla con módulos ES.
- `@supabase/supabase-js` v2 se carga por CDN (jsdelivr, UMD → `window.supabase`).
- El secreto (**anon key**) vive en un único `js/config.js` compartido por las
  dos apps. Escala agregando otra página `otra-app.html` + módulos `otra-*.js`.

## Datos que consume

- Vista **`panel_pedidos`** (SELECT para usuarios autenticados). Se filtra por
  `estado = 'en_camino'` y se cuentan los `'entregado'` para el marcador
  "Entregados hoy".
- RPC **`accion_staff(p_accion, p_numero, p_actor)`** → `{ ok, mensaje }`. Única
  vía para cambiar estado (nunca un UPDATE directo):
  - `'entregado'` → cierra la entrega.
  - `'planton'` → nadie recibió; el sistema marca al cliente como *solo prepago*.
- **Realtime** sobre `orders` (ya está en la publicación `supabase_realtime`) +
  **polling de respaldo cada 15 s**.

## La tarjeta de entrega

1. **#Número** enorme + cronómetro de minutos en camino.
2. **Bloque de cobro** (lo más importante), con semáforo:
   - Yape/Plin → **verde**: *✅ YA PAGADO — NO cobrar*.
   - Efectivo con `paga_con` → **ámbar**: *💵 COBRAR S/X* y el **VUELTO en
     tipografía gigante*.
   - Efectivo sin `paga_con` → **ámbar**: *monto exacto, sin vuelto*.
   - Si hay `agregado_texto` → **franja rayada roja** (puede haber un adicional
     que se cobra en efectivo aunque el pedido esté pagado con Yape).
3. **Dirección** + referencia + zona, en texto grande.
4. **Botón gigante 🗺 IR CON GOOGLE MAPS** (≥56px): usa el pin
   (`latitude`/`longitude`) si existe, si no busca la dirección escrita.
5. **Cliente**: nombre + **📞 Llamar** y **💬 WhatsApp** (celular peruano se
   normaliza con código 51).
6. **Items** del pedido (colapsable, para revisar la bolsa).
7. **Cierre**: **✔️ ENTREGADO** (verde, gigante) y **⚠️ Nadie respondió** (rojo,
   separado, con confirmación) para evitar toques accidentales.

## Deploy en Coolify

El **mismo servicio** ya publicado sirve las dos apps; no hay que crear otro.

1. Haz commit y push de estos archivos nuevos/modificados al repo.
2. En Coolify, en el servicio del panel, dispara un **Redeploy** (el `Dockerfile`
   ya copia `reparto.html` y `img/`).
3. Rutas resultantes:
   - `https://TU-DOMINIO/` → panel del staff.
   - `https://TU-DOMINIO/reparto.html` → **app de los motorizados**.

> Si prefieres un subdominio propio (p. ej. `reparto.guidos.pe`), en Coolify
> puedes apuntar otro dominio al mismo contenedor; la app ya funciona en
> cualquier ruta porque todas sus referencias son relativas.

### Build local (opcional, para probar)

```bash
docker build -t guidos-web .
docker run --rm -p 8080:80 guidos-web
# Panel:       http://localhost:8080/
# Motorizados: http://localhost:8080/reparto.html
```

## Crear la cuenta del motorizado (una sola vez)

En el **dashboard de Supabase** → *Authentication → Users → Add user*:

- **Email:** `motorizado@guidos.pe`
- **Password:** (la que definas; entrégasela al repartidor)
- Marca *Auto Confirm User* para que pueda entrar de una.

El staff sigue usando `staff@guidos.pe` en su panel. Son **dos logins
distintos** sobre la **misma base**.

## Seguridad

- En el navegador va **solo la anon key**, nunca la `service_role`.
- El acceso lo da la **sesión de Supabase Auth**; las vistas y la RPC solo
  tienen *grant* a `authenticated`.
- **Todo** texto dinámico (dirección, nombre, notas, agregado) viene de WhatsApp
  = entrada no confiable, y se **escapa** antes de tocar el DOM. Los enlaces
  (maps/tel/wa) usan solo dígitos o `encodeURIComponent`.
- El cliente del reparto usa un `storageKey` propio: la sesión del motorizado no
  pisa la del staff aunque ambas apps compartan dominio.
- Cabeceras y **CSP** los pone `nginx.conf` (ya permite fonts de Google, el CDN
  de Supabase, `connect` a Supabase y `img 'self'` para el logo).

> **Separación de roles:** hoy la separación entre staff y motorizado es de
> interfaz + sesión, sobre la misma base. Si más adelante se quiere separación
> *dura* de permisos por rol, se hará con una tabla de roles + políticas RLS
> (fuera de alcance ahora).
