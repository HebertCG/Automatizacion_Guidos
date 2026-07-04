// ============================================================
//  Autenticación (Supabase Auth · email + contraseña).
//  Las cuentas del staff se crean a mano en Supabase.
// ============================================================
import { sb } from "./supabase.js";

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
    return "Sin conexión. Revisa el internet e inténtalo de nuevo.";
  if (m.includes("rate")) return "Demasiados intentos. Espera un momento.";
  return "No se pudo iniciar sesión. Inténtalo otra vez.";
}
