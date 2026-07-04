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

// Umbrales de respaldo (minutos) por si guidos_config no trae algún wd_*.
// El semáforo de cada tarjeta usa: verde < alerta  ≤  ámbar < urgente  ≤  rojo.
export const UMBRALES_DEFAULT = {
  pago_en_revision: { alerta: 5, urgente: 15 },
  por_aceptar: { alerta: 5, urgente: 12 },
  en_cocina: { alerta: 40, urgente: 55 },
  en_camino: { alerta: 45, urgente: 60 },
  esperando_pago: { alerta: 10, urgente: 25 },
};
