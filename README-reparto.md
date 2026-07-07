# Guido's · Reparto 🛵 — vista del motorizado (por rol)

Web app **móvil** para los repartidores de Guido's. **No es otra página ni otra
URL**: es la **misma** `panelguidos.klassia.lat`, y la vista que se muestra
**depende de quién inicia sesión**:

- `staff@guidos.pe` entra → ve el **panel de cocina** (pedidos, carta, historial…).
- `motorizado@guidos.pe` entra → ve **solo sus entregas** (nada de cocina).

Pensada para usarse en el celular, en la calle, con una sola mano y a pleno sol:
todo grande, oscuro y de alto contraste.

## Cómo funciona el enrutado por rol

Un **solo login** y un **solo `index.html`**. Al iniciar sesión, el router mira
el rol del usuario y monta la vista correspondiente:

```
index.html
 └─ js/session-router.js      ← login único + decide el rol
      ├─ rol "staff"    → js/app.js          (panel de cocina, con css/styles.css)
      └─ rol "reparto"  → js/reparto-app.js   (entregas, con css/reparto.css)
```

- El **rol** se resuelve en `js/roles.js`: primero mira el `user_metadata.role`
  del usuario en Supabase; si no, usa el mapa de `js/config.js`
  (`ROLES_POR_EMAIL`); si el correo no está, cae al **rol de menor privilegio**
  (`reparto`), para que una cuenta nueva nunca vea el panel del staff por error.
- Los módulos de cada app se cargan **de forma perezosa** (solo se descarga el
  que se usa). La hoja `css/reparto.css` se agrega/retira dinámicamente, así los
  estilos de las dos apps no se mezclan.

### Agregar / cambiar usuarios y roles

Edita el mapa en [`js/config.js`](js/config.js):

```js
export const ROLES_POR_EMAIL = {
  "staff@guidos.pe": "staff",
  "motorizado@guidos.pe": "reparto",
  // "motorizado2@guidos.pe": "reparto",
  // "gerente@guidos.pe": "staff",
};
```

(O bien, en Supabase → Authentication → el usuario → *User metadata*, agrega
`{ "role": "reparto" }` y no hace falta tocar el código.)

## Arquitectura (dentro del mismo proyecto)

Sin carpeta aparte y sin build: ambas vistas comparten `css/`, `js/` e `img/`.

```
panelguidos/
├── index.html                 # login único + shells de ambas vistas
├── css/
│   ├── styles.css             # panel del staff
│   └── reparto.css            # vista del reparto (se carga por rol)
├── img/
│   └── logo-guidos.png        # logo (marca + favicon)
└── js/
    ├── config.js              # SUPABASE_URL + ANON_KEY + ROLES_POR_EMAIL
    ├── supabase.js · auth.js  # cliente + auth COMPARTIDOS (una sola sesión)
    ├── roles.js               # rolDeSesion(session)
    ├── session-router.js      # login + enruta por rol
    ├── app.js · data.js · render.js · ui.js · actions.js · realtime.js  # staff
    ├── reparto-data.js        # en_camino + contador + realtime + accion_staff
    ├── reparto-render.js      # tarjeta de entrega (escapa texto de WhatsApp)
    └── reparto-app.js         # vista del motorizado (arrancar/detener)
```

## Datos que consume la vista de reparto

- Vista **`panel_pedidos`** filtrada por `estado = 'en_camino'`; cuenta los
  `'entregado'` para el marcador "Entregados hoy".
- RPC **`accion_staff(p_accion, p_numero, p_actor)`** → `{ ok, mensaje }`:
  `'entregado'` cierra la entrega; `'planton'` marca al cliente como *solo
  prepago*.
- **Realtime** sobre `orders` + **polling de respaldo cada 15 s**.

## La tarjeta de entrega

`#Número` gigante + cronómetro → **bloque de cobro** con semáforo (🟢 pagado /
no cobrar · 🟡 cobrar efectivo con el **vuelto en tipografía gigante** o monto
exacto) → **franja roja** si hay `agregado_texto` → dirección grande → **🗺 botón
gigante a Google Maps** (pin o dirección) → **📞 Llamar / 💬 WhatsApp** →
items colapsables → **✔️ ENTREGADO** (verde) y **⚠️ Nadie respondió** (rojo,
separado, con confirmación).

## Deploy en Coolify

El **mismo servicio** ya publicado sirve todo; no hay que crear otro.

1. `git push` de estos cambios a `main`.
2. En Coolify, **Redeploy** del servicio del panel. (En el log debe verse que
   construye el commit nuevo, **no** *"Build step skipped"* — si lo dice, es que
   no se subió el commit.)
3. Resultado: **una sola URL**, `panelguidos.klassia.lat`. El staff entra y ve
   la cocina; el motorizado entra y ve sus entregas.

```bash
# Prueba local
docker build -t guidos-web . && docker run --rm -p 8080:80 guidos-web
# http://localhost:8080/  (login staff → cocina · login motorizado → reparto)
```

## Crear la cuenta del motorizado (una sola vez)

Ya está creada: `motorizado@guidos.pe` (visible en Supabase → Authentication →
Users). Para nuevos repartidores: *Add user*, marca *Auto Confirm*, y agrégalo a
`ROLES_POR_EMAIL` (o ponle `user_metadata.role = "reparto"`).

## Seguridad — importante y honesto

- En el navegador va **solo la anon key**, nunca la `service_role`.
- Todo texto dinámico de WhatsApp se **escapa** antes del DOM; los enlaces
  (maps/tel/wa) usan solo dígitos o `encodeURIComponent`.
- **El enrutado por rol es de interfaz, no de datos.** Hoy cualquier usuario
  `authenticated` puede, técnicamente, leer las mismas vistas y llamar la misma
  RPC (los permisos son a nivel `authenticated`). Es decir: el motorizado no
  *verá* el panel del staff, pero la separación **no** es una barrera de datos.
- Para **separación dura por rol** (que el motorizado no pueda leer/escribir
  datos del staff aunque manipule el frontend) hace falta **RLS por rol** en
  Supabase: una función que lea el rol del JWT/tabla y políticas por tabla.
  Es el siguiente paso recomendado y se puede montar aparte.
