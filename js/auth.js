// ============================================================
//  Autenticación (Supabase Auth · email + contraseña).
//  Las cuentas del staff se crean a mano en Supabase.
//
//  MODO DEMO: las cuentas `demo.*@guidos.pe` se resuelven en el
//  navegador, sin red (ver js/demo/demo-sesion.js). Si el correo no
//  es de demo, todo sigue yendo contra Supabase como siempre.
// ============================================================
import { sb } from "./supabase.js";
import * as demo from "./demo/demo-sesion.js";

// Oyentes del router. En demo los avisamos nosotros, porque
// Supabase nunca va a emitir un cambio de sesión que no existe.
const oyentes = new Set();

function avisar(session) {
  for (const cb of oyentes) {
    try {
      cb(session);
    } catch {
      /* un oyente roto no debe tumbar a los demás */
    }
  }
}

export async function getSession() {
  const d = demo.guardada();
  if (d) return d;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

export function currentEmail(session) {
  return session?.user?.email ?? "";
}

export async function signIn(email, password) {
  const d = demo.autenticar(email, password);
  if (d) {
    demo.guardar(d);
    avisar(d);
    return d;
  }
  // Correo de demo pero contraseña equivocada: no tiene sentido
  // preguntarle a Supabase por una cuenta que solo existe aquí.
  if (demo.esCorreoDemo(email)) {
    throw new Error("Invalid login credentials");
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  if (demo.activo()) {
    demo.limpiar();
    avisar(null);
    return;
  }
  await sb.auth.signOut();
}

// Devuelve la suscripción; llamar .unsubscribe() para soltarla.
export function onAuthChange(cb) {
  oyentes.add(cb);
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    // Dentro de una sesión de demo, Supabase no manda: sus eventos
    // (INITIAL_SESSION, fallos de refresco…) desmontarían la vista.
    if (demo.activo()) return;
    cb(session);
  });
  return {
    unsubscribe() {
      oyentes.delete(cb);
      data.subscription.unsubscribe();
    },
  };
}

// Traduce errores de Supabase Auth a mensajes amables en español.
export function mensajeLogin(error) {
  const m = String(error?.message || "").toLowerCase();
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "La cuenta aún no está confirmada.";
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to fetch"))
    return "No se pudo conectar con el servidor. Prueba con una cuenta de demo.";
  if (m.includes("rate")) return "Demasiados intentos. Espera un momento.";
  return "No se pudo iniciar sesión. Inténtalo otra vez.";
}
