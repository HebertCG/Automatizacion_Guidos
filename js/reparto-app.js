// ============================================================
//  Guido's · Reparto — orquestador de la app del motorizado.
//  - Login / sesión persistente / logout
//  - Lista de entregas en_camino (realtime + respaldo 15s)
//  - Acciones de cierre: entregado / planton (vía accion_staff)
//  - Toasts + modal de confirmación (sin dependencias)
// ============================================================
import * as auth from "./reparto-auth.js";
import * as data from "./reparto-data.js";
import { tarjetaEntrega, minutosDesde, textoMin } from "./reparto-render.js";

const TICK_MS = 30000; // refresco del cronómetro (minutos → 30s basta)

const state = {
  activo: false,
  email: "",
  entregas: [],
  accionesEnCurso: 0,
  repintarPendiente: false,
  unsub: null,
  timers: { poll: null, tick: null, debounce: null },
};

// ============================================================
//  UI utilitaria (toast + modal), sin librerías.
// ============================================================

function toast(msg, tipo = "info") {
  const cont = document.getElementById("toasts");
  if (!cont) return;
  const el = document.createElement("div");
  el.className = `toast toast--${tipo}`;
  el.textContent = msg;
  cont.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 4200);
}

function confirmar({ titulo, mensaje, ok = "Sí, confirmar", cancelar = "No" }) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "modal-ov";
    ov.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3 class="modal__t">${escAttr(titulo)}</h3>
        <p class="modal__m">${escAttr(mensaje)}</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" data-r="0">${escAttr(cancelar)}</button>
          <button class="btn btn--planton" data-r="1">${escAttr(ok)}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("show"));
    function cerrar(v) {
      ov.classList.remove("show");
      setTimeout(() => ov.remove(), 200);
      resolve(v);
    }
    ov.addEventListener("click", (e) => {
      if (e.target === ov) return cerrar(false);
      const b = e.target.closest("[data-r]");
      if (b) cerrar(b.dataset.r === "1");
    });
  });
}

// Escape mínimo para textos de la propia app (títulos de modal).
function escAttr(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ============================================================
//  Pintado
// ============================================================

function pintar(entregas) {
  state.entregas = entregas;
  // No repintar mientras haya una acción en curso: evitaría que un
  // refresco reactive un botón que el motorizado ya tocó.
  if (state.accionesEnCurso > 0) {
    state.repintarPendiente = true;
    return;
  }
  const cont = document.getElementById("lista");
  if (!cont) return;
  cont.innerHTML = entregas.length
    ? entregas.map(tarjetaEntrega).join("")
    : `<div class="vacio">
         <div class="vacio__emoji">🎉</div>
         <p class="vacio__t">Nada en reparto</p>
         <p class="vacio__s">Espera que cocina despache</p>
       </div>`;
}

function refrescarTimers() {
  document.querySelectorAll(".entrega[data-desde]").forEach((el) => {
    const t = el.querySelector(".t-min");
    if (t) t.textContent = textoMin(minutosDesde(el.dataset.desde));
  });
}

function setContador(n) {
  const el = document.getElementById("entregados-hoy");
  if (el) el.textContent = String(n);
}

function marcarOnline(ok) {
  const el = document.getElementById("offline");
  if (el) el.classList.toggle("hidden", ok);
}

// ============================================================
//  Datos
// ============================================================

async function refrescar() {
  try {
    const [entregas, count] = await Promise.all([
      data.fetchEnCamino(),
      data.contarEntregadosHoy(),
    ]);
    pintar(entregas);
    setContador(count);
    refrescarTimers();
    marcarOnline(true);
  } catch (e) {
    console.error("[refrescar]", e);
    marcarOnline(false);
  }
}

function debouncedRefresh() {
  clearTimeout(state.timers.debounce);
  state.timers.debounce = setTimeout(refrescar, 500);
}

// ============================================================
//  Acciones de cierre (entregado / planton)
// ============================================================

async function ejecutarAccion(accion, numero, card) {
  if (accion === "planton") {
    const ok = await confirmar({
      titulo: "¿Nadie respondió?",
      mensaje:
        "Se marcará el plantón y el cliente deberá PREPAGAR sus próximos pedidos. ¿Seguro?",
      ok: "Sí, fue plantón",
      cancelar: "No, volver",
    });
    if (!ok) return;
  }

  // Deshabilita ambos botones de cierre de esta tarjeta.
  const botones = card.querySelectorAll(".entrega__cierre .btn");
  botones.forEach((b) => (b.disabled = true));
  card.classList.add("entrega--enviando");
  state.accionesEnCurso++;

  try {
    const res = await data.accionStaff(accion, numero, state.email);
    const r = Array.isArray(res) ? res[0] : res;
    if (r && r.ok) {
      toast(r.mensaje || "Listo ✔️", "ok");
      // Quita la tarjeta con una pequeña salida.
      card.classList.add("entrega--saliendo");
      setTimeout(() => card.remove(), 260);
    } else {
      toast((r && r.mensaje) || "No se pudo completar la acción.", "err");
      botones.forEach((b) => (b.disabled = false));
      card.classList.remove("entrega--enviando");
    }
  } catch (e) {
    console.error("[accion]", e);
    toast("Sin señal. Revisa tus datos e intenta otra vez.", "err");
    botones.forEach((b) => (b.disabled = false));
    card.classList.remove("entrega--enviando");
  } finally {
    state.accionesEnCurso = Math.max(0, state.accionesEnCurso - 1);
    // Reconciliar con el servidor (actualiza contador y lista real).
    if (state.accionesEnCurso === 0) {
      state.repintarPendiente = false;
      await refrescar();
    }
  }
}

// ============================================================
//  Entrar / salir
// ============================================================

async function entrar(session) {
  if (state.activo) return;
  state.activo = true;
  state.email = auth.currentEmail(session);

  document.getElementById("login").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  const who = document.getElementById("user-email");
  if (who) who.textContent = state.email;

  await refrescar();

  state.unsub = data.suscribirPedidos(debouncedRefresh);
  state.timers.poll = setInterval(refrescar, data.POLL_MS);
  state.timers.tick = setInterval(refrescarTimers, TICK_MS);
}

function salir() {
  state.activo = false;
  if (state.unsub) {
    state.unsub();
    state.unsub = null;
  }
  clearInterval(state.timers.poll);
  clearInterval(state.timers.tick);
  clearTimeout(state.timers.debounce);
  state.entregas = [];
  document.getElementById("app").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");
}

// ============================================================
//  Eventos
// ============================================================

function wireEventos() {
  // Login
  const form = document.getElementById("login-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value;
    const err = document.getElementById("login-error");
    const btn = document.getElementById("login-btn");
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

  // Clicks delegados (acciones de cierre)
  document.addEventListener("click", async (e) => {
    const act = e.target.closest("[data-action]");
    if (act) {
      const card = act.closest(".entrega");
      if (!card) return;
      await ejecutarAccion(act.dataset.action, Number(act.dataset.numero), card);
      return;
    }
    if (e.target.closest("#btn-refrescar")) {
      await refrescar();
      toast("Actualizado", "info");
      return;
    }
    if (e.target.closest("#btn-logout")) {
      await auth.signOut();
      return;
    }
  });

  window.addEventListener("online", () => marcarOnline(true));
  window.addEventListener("offline", () => marcarOnline(false));
  // Al volver a la app (desbloqueo del cel), refresca de una.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.activo) refrescar();
  });
}

// ============================================================
//  Arranque
// ============================================================

async function main() {
  wireEventos();
  auth.onAuthChange((session) => {
    if (session) entrar(session);
    else salir();
  });
  const s = await auth.getSession();
  if (s) await entrar(s);
  else salir();
}

main();
