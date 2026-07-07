// ============================================================
//  Guido's · Reparto — autenticación del motorizado.
//  Supabase Auth (email + contraseña). La cuenta se crea a mano
//  en el dashboard de Supabase: motorizado@guidos.pe.
//  Misma base que el staff; la separación es de interfaz + sesión.
// ============================================================
import { sb } from "./reparto-supabase.js";

export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

export function currentEmail(session) {
  return session?.user?.email ?? "";
}

export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  await sb.auth.signOut();
}

// Devuelve la suscripción; llamar .unsubscribe() para soltarla.
export function onAuthChange(cb) {
  const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session));
  return data.subscription;
}

// Traduce errores de Supabase Auth a mensajes amables en español.
export function mensajeLogin(error) {
  const m = String(error?.message || "").toLowerCase();
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "La cuenta aún no está confirmada.";
  if (m.includes("network") || m.includes("fetch"))
    return "Sin señal. Revisa tus datos móviles e inténtalo de nuevo.";
  if (m.includes("rate")) return "Demasiados intentos. Espera un momento.";
  return "No se pudo iniciar sesión. Inténtalo otra vez.";
}
