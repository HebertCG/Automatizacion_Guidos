// ============================================================
//  Guido's · Router de sesión (un solo login, una sola URL).
//  Cablea el login compartido, escucha la sesión de Supabase Auth
//  y, según el ROL, monta el PANEL DEL STAFF (js/app.js) o la APP
//  DE REPARTO (js/reparto-app.js). Los módulos de cada app se
//  importan de forma perezosa: solo se descarga el que se usa.
//
//  Para no mezclar los estilos de ambas apps en la misma página,
//  la hoja css/reparto.css se agrega/retira dinámicamente: así
//  cada app conserva su CSS intacto y no hay colisiones de clases.
// ============================================================
import * as auth from "./auth.js";
import { rolDeSesion } from "./roles.js";

const el = (id) => document.getElementById(id);

let appActiva = null; // módulo montado ({ arrancar, detener })
let rolActivo = null; // "staff" | "reparto"

// ---------- CSS del reparto, bajo demanda ----------
function setRepartoCss(on) {
  const id = "reparto-css";
  const existente = el(id);
  if (on && !existente) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "css/reparto.css";
    document.head.appendChild(link);
  } else if (!on && existente) {
    existente.remove();
  }
}

// ---------- Montaje por rol ----------
async function montar(session) {
  const rol = rolDeSesion(session);
  if (rolActivo === rol && appActiva) return; // ya está la vista correcta

  if (appActiva?.detener) appActiva.detener();
  appActiva = null;

  el("login").classList.add("hidden");

  if (rol === "reparto") {
    el("app").classList.add("hidden");
    setRepartoCss(true);
    el("app-reparto").classList.remove("hidden");
    const m = await import("./reparto-app.js");
    await m.arrancar(session);
    appActiva = m;
    rolActivo = "reparto";
  } else {
    setRepartoCss(false);
    el("app-reparto").classList.add("hidden");
    el("app").classList.remove("hidden");
    const m = await import("./app.js");
    await m.arrancar(session);
    appActiva = m;
    rolActivo = "staff";
  }
}

function desmontar() {
  if (appActiva?.detener) appActiva.detener();
  appActiva = null;
  rolActivo = null;
  setRepartoCss(false);
  el("app").classList.add("hidden");
  el("app-reparto").classList.add("hidden");
  el("login").classList.remove("hidden");
}

// ---------- Login compartido ----------
function wireLogin() {
  const form = el("login-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = el("email").value.trim();
    const pass = el("password").value;
    const err = el("login-error");
    const btn = el("login-btn");
    err.textContent = "";
    btn.disabled = true;
    btn.classList.add("is-loading");
    try {
      await auth.signIn(email, pass);
    } catch (ex) {
      err.textContent = auth.mensajeLogin(ex);
    } finally {
      btn.disabled = false;
      btn.classList.remove("is-loading");
    }
  });

  // Botones de acceso demo: rellenan el formulario y lo envían.
  form.addEventListener("click", (e) => {
    const b = e.target.closest("[data-demo]");
    if (!b) return;
    const correo =
      b.dataset.demo === "reparto" ? "demo.reparto@guidos.pe" : "demo.staff@guidos.pe";
    el("email").value = correo;
    el("password").value = "GuidosDemo2026!";
    form.requestSubmit();
  });

  // Cerrar sesión desde cualquiera de las dos apps.
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-logout]")) auth.signOut();
  });
}

// ---------- Arranque ----------
async function main() {
  wireLogin();
  auth.onAuthChange((session) => {
    if (session) montar(session);
    else desmontar();
  });
  const s = await auth.getSession();
  if (s) await montar(s);
  else desmontar();
}

main();
