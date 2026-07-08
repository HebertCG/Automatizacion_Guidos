// ============================================================
//  Guido's · Reparto — vista del motorizado (rol "reparto").
//  NO maneja login ni sesión: eso lo hace js/session-router.js,
//  que llama a arrancar(session) / detener() según el rol.
//  Usa la MISMA sesión y cliente Supabase que el resto del sistema.
// ============================================================
import * as data from "./reparto-data.js";
import { tarjetaEntrega, minutosDesde, textoMin } from "./reparto-render.js";

const TICK_MS = 30000; // refresco del cronómetro (minutos → 30s basta)

const state = {
  activo: false,
  email: "",
  entregas: [],
  accionesEnCurso: 0,
  unsub: null,
  timers: { poll: null, tick: null, debounce: null },
};

const el = (id) => document.getElementById(id);

// ============================================================
//  UI utilitaria (toast + modal), sin librerías.
// ============================================================

function toast(msg, tipo = "info") {
  const cont = el("toasts");
  if (!cont) return;
  const t = document.createElement("div");
  t.className = `toast toast--${tipo}`;
  t.textContent = msg;
  cont.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 4200);
}

function confirmar({ titulo, mensaje, ok = "Sí, confirmar", cancelar = "No" }) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "modal-ov";
    ov.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3 class="modal__t">${escTxt(titulo)}</h3>
        <p class="modal__m">${escTxt(mensaje)}</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" data-r="0">${escTxt(cancelar)}</button>
          <button class="btn btn--planton" data-r="1">${escTxt(ok)}</button>
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

// Modal para el código de entrega: el cliente se lo dicta al motorizado
// al recibir el pedido. Resuelve con el código (5 dígitos) o null.
function pedirCodigo(numero) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "modal-ov";
    ov.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3 class="modal__t">🔐 Código de entrega · #${escTxt(numero)}</h3>
        <p class="modal__m">Pídele al cliente el código de 5 dígitos que le llegó por WhatsApp cuando saliste en camino.</p>
        <input class="modal__codigo" type="tel" inputmode="numeric" maxlength="5"
               pattern="[0-9]*" placeholder="•••••" autocomplete="one-time-code"
               aria-label="Código de entrega de 5 dígitos">
        <div class="modal__actions">
          <button class="btn btn--ghost" data-r="0">Cancelar</button>
          <button class="btn btn--entregado" data-r="1" disabled>Confirmar entrega</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("show"));
    const input = ov.querySelector(".modal__codigo");
    const okBtn = ov.querySelector('[data-r="1"]');
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 5);
      okBtn.disabled = input.value.length !== 5;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.length === 5) cerrar(input.value);
    });
    setTimeout(() => input.focus(), 250);
    function cerrar(v) {
      ov.classList.remove("show");
      setTimeout(() => ov.remove(), 200);
      resolve(v);
    }
    ov.addEventListener("click", (e) => {
      if (e.target === ov) return cerrar(null);
      const b = e.target.closest("[data-r]");
      if (!b) return;
      if (b.dataset.r === "0") return cerrar(null);
      if (input.value.length === 5) cerrar(input.value);
    });
  });
}

function escTxt(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ============================================================
//  Pintado
// ============================================================

function pintar(entregas) {
  state.entregas = entregas;
  if (state.accionesEnCurso > 0) return; // no repintar con una acción en curso
  const cont = el("lista");
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
  document.querySelectorAll("#app-reparto .entrega[data-desde]").forEach((card) => {
    const t = card.querySelector(".t-min");
    if (t) t.textContent = textoMin(minutosDesde(card.dataset.desde));
  });
}

function setContador(n) {
  const c = el("entregados-hoy");
  if (c) c.textContent = String(n);
}

function marcarOnline(ok) {
  const o = el("rep-offline");
  if (o) o.classList.toggle("hidden", ok);
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
    console.error("[reparto/refrescar]", e);
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
  let codigo = null;

  if (accion === "entregado") {
    codigo = await pedirCodigo(numero);
    if (!codigo) return; // canceló el modal
  }

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

  const botones = card.querySelectorAll(".entrega__cierre .btn");
  botones.forEach((b) => (b.disabled = true));
  card.classList.add("entrega--enviando");
  state.accionesEnCurso++;

  try {
    const res = await data.accionStaff(accion, numero, state.email, codigo);
    const r = Array.isArray(res) ? res[0] : res;
    if (r && r.ok) {
      toast(r.mensaje || "Listo ✔️", "ok");
      card.classList.add("entrega--saliendo");
      setTimeout(() => card.remove(), 260);
    } else {
      toast((r && r.mensaje) || "No se pudo completar la acción.", "err");
      botones.forEach((b) => (b.disabled = false));
      card.classList.remove("entrega--enviando");
    }
  } catch (e) {
    console.error("[reparto/accion]", e);
    toast("Sin señal. Revisa tus datos e intenta otra vez.", "err");
    botones.forEach((b) => (b.disabled = false));
    card.classList.remove("entrega--enviando");
  } finally {
    state.accionesEnCurso = Math.max(0, state.accionesEnCurso - 1);
    if (state.accionesEnCurso === 0) await refrescar();
  }
}

// ============================================================
//  Eventos (se cablean una sola vez, al importar el módulo)
// ============================================================

function wireEventos() {
  const root = el("app-reparto");
  if (root) {
    root.addEventListener("click", async (e) => {
      const act = e.target.closest("[data-action]");
      if (act) {
        const card = act.closest(".entrega");
        if (card) await ejecutarAccion(act.dataset.action, Number(act.dataset.numero), card);
        return;
      }
      if (e.target.closest("#rep-refrescar")) {
        await refrescar();
        toast("Actualizado", "info");
      }
    });
  }
  window.addEventListener("online", () => marcarOnline(true));
  window.addEventListener("offline", () => marcarOnline(false));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.activo) refrescar();
  });
}

// ============================================================
//  API para el router: arrancar / detener
// ============================================================

export async function arrancar(session) {
  if (state.activo) return;
  state.activo = true;
  state.email = session?.user?.email ?? "";
  const who = el("rep-user-email");
  if (who) who.textContent = state.email;

  await refrescar();

  state.unsub = data.suscribirPedidos(debouncedRefresh);
  state.timers.poll = setInterval(refrescar, data.POLL_MS);
  state.timers.tick = setInterval(refrescarTimers, TICK_MS);
}

export function detener() {
  state.activo = false;
  if (state.unsub) {
    state.unsub();
    state.unsub = null;
  }
  clearInterval(state.timers.poll);
  clearInterval(state.timers.tick);
  clearTimeout(state.timers.debounce);
  state.entregas = [];
}

wireEventos();
