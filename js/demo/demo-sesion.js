// ============================================================
//  Guido's · MODO DEMO — sesión sin backend.
//
//  Dos cuentas de muestra que NO existen en Supabase: se resuelven
//  aquí mismo, en el navegador. Sirven para recorrer el sistema
//  (panel de cocina y app de reparto) sin credenciales reales y sin
//  depender de que el backend esté levantado.
//
//  El objeto de sesión imita la forma del de Supabase Auth, así
//  `roles.js` y las dos apps lo consumen sin cambios: lo único que
//  miran es `user.email` y `user.user_metadata.role`.
// ============================================================

const CLAVE = "guidos.demo.sesion";

export const CUENTAS_DEMO = {
  "demo.staff@guidos.pe": {
    password: "GuidosDemo2026!",
    role: "staff",
    nombre: "Demo · Cocina",
  },
  "demo.reparto@guidos.pe": {
    password: "GuidosDemo2026!",
    role: "reparto",
    nombre: "Demo · Reparto",
  },
};

function construirSesion(email, cuenta) {
  return {
    demo: true,
    access_token: "demo",
    user: {
      id: `demo-${cuenta.role}`,
      email,
      user_metadata: { role: cuenta.role, full_name: cuenta.nombre },
      app_metadata: { role: cuenta.role },
    },
  };
}

// Devuelve la sesión demo si las credenciales coinciden; null si no.
// Que devuelva null es lo que hace que el login siga su curso normal
// contra Supabase para las cuentas reales.
export function autenticar(email, password) {
  const correo = String(email || "").trim().toLowerCase();
  const cuenta = CUENTAS_DEMO[correo];
  if (!cuenta || password !== cuenta.password) return null;
  return construirSesion(correo, cuenta);
}

// ¿El correo es de demo? (sin validar la contraseña)
export function esCorreoDemo(email) {
  return Boolean(CUENTAS_DEMO[String(email || "").trim().toLowerCase()]);
}

// ---------- Persistencia (solo la sesión; los datos se resiembran) ----------
//
//  La sesión se guarda en memoria SIEMPRE, y en localStorage cuando se
//  puede. En modo incógnito —o con el storage bloqueado— la demo sigue
//  funcionando completa; lo único que se pierde es sobrevivir a un F5.

let enMemoria = null;

export function guardar(session) {
  enMemoria = session.user.email;
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ email: enMemoria }));
  } catch {
    /* storage bloqueado: nos basta con `enMemoria` */
  }
}

export function guardada() {
  let email = enMemoria;
  if (!email) {
    try {
      const raw = localStorage.getItem(CLAVE);
      if (raw) email = JSON.parse(raw).email;
    } catch {
      /* storage ilegible: seguimos sin sesión persistida */
    }
  }
  if (!email) return null;
  const cuenta = CUENTAS_DEMO[email];
  return cuenta ? construirSesion(email, cuenta) : null;
}

export function limpiar() {
  enMemoria = null;
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que limpiar */
  }
}

// ¿Estamos dentro de una sesión de demo ahora mismo?
export function activo() {
  return guardada() !== null;
}
