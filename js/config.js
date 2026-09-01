// ============================================================
//  Guido's · Panel de pedidos — configuración
//  ⚠️  AQUÍ SOLO VA LA CLAVE PÚBLICA (anon / publishable).
//      NUNCA pongas la service_role: quedaría expuesta en el
//      navegador y daría acceso total a la base de datos.
// ============================================================

export const SUPABASE_URL = "https://zgpeyyzrpbdpstrcevun.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpncGV5eXpycGJkcHN0cmNldnVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMDk0MDUsImV4cCI6MjA5ODY4NTQwNX0.G6LZSkDjbegVzVSEBgCC0mNizcFKsgFOJVMk0EmnB9A";

// Refresco de respaldo del tablero (además del tiempo real), en ms.
export const REFRESH_MS = 20000;

// ------------------------------------------------------------
//  Roles → qué vista ve cada usuario al iniciar sesión.
//  Un solo login y una sola URL: el rol decide si se monta el
//  PANEL DEL STAFF o la APP DE REPARTO. Fuente única y editable:
//  agrega aquí cada cuenta nueva.
//  (Nota: esto es enrutado de interfaz. La separación DURA de
//   datos por rol se hace con RLS en Supabase — ver README.)
// ------------------------------------------------------------
export const ROLES_POR_EMAIL = {
  // Cuentas de producción.
  "staff@guidos.pe": "staff",
  "motorizado@guidos.pe": "reparto",

  // Cuentas de DEMO (credenciales publicadas en el README). Existen solo
  // para que alguien pueda recorrer el sistema sin pedir acceso. Se crean
  // en Supabase Auth y en `staff_roles` igual que cualquier otra cuenta.
  "demo.staff@guidos.pe": "staff",
  "demo.reparto@guidos.pe": "reparto",
};

// Si un correo no está en el mapa, se asume el rol de MENOR privilegio
// (reparto): así una cuenta nueva nunca ve el panel del staff por error.
export const ROL_POR_DEFECTO = "reparto";

// Umbrales de respaldo (minutos) por si guidos_config no trae algún wd_*.
// El semáforo de cada tarjeta usa: verde < alerta  ≤  ámbar < urgente  ≤  rojo.
export const UMBRALES_DEFAULT = {
  pago_en_revision: { alerta: 5, urgente: 15 },
  por_aceptar: { alerta: 5, urgente: 12 },
  en_cocina: { alerta: 40, urgente: 55 },
  en_camino: { alerta: 45, urgente: 60 },
  esperando_pago: { alerta: 10, urgente: 25 },
};
