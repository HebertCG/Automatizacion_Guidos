// ============================================================
//  UI utilitaria: formato, escape, semáforo, toasts, modal de
//  confirmación, sonido, parpadeo del título, pestañas y timers.
//  No conoce datos ni acciones: solo pinta y avisa.
// ============================================================

// ---------- Formato / seguridad ----------

// Escapa TODO valor dinámico antes de meterlo en innerHTML.
// Nombres/direcciones/notas vienen de WhatsApp = entrada no confiable.
export function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export function soles(n) {
  const x = Number(n) || 0;
  return "S/ " + x.toFixed(2);
}

export function digits(s) {
  return String(s || "").replace(/\D/g, "");
}

export function minutosDesde(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

export function textoMin(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function fechaCorta(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const NOMBRE_ESTADO = {
  esperando_pago: "Esperando pago",
  pago_en_revision: "Revisar pago",
  por_aceptar: "Por aceptar",
  en_cocina: "En cocina",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};
export function nombreEstado(e) {
  return NOMBRE_ESTADO[e] || e || "—";
}

// ---------- Semáforo por tiempo ----------

let UMBRALES = {};
export function setUmbrales(u) {
  UMBRALES = u || {};
}
export function nivelSemaforo(estado, min) {
  const u = UMBRALES[estado];
  if (!u) return "ok";
  if (min >= u.urgente) return "urgent";
  if (min >= u.alerta) return "warn";
  return "ok";
}

// ---------- Toasts ----------

export function toast(msg, tipo = "info") {
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
  }, 4000);
}

// ---------- Modal de confirmación (promesa) ----------

export function confirmar({
  titulo,
  mensaje,
  ok = "Confirmar",
  cancelar = "Cancelar",
  peligro = false,
  dobleConfirmacion = false,
} = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "modal-ov";
    ov.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <h3 class="modal__t">${esc(titulo)}</h3>
        <p class="modal__m">${esc(mensaje)}</p>
        ${dobleConfirmacion
        ? `<label class="modal__chk"><input type="checkbox" id="modal-doble"> Confirmo que fue un plantón real</label>`
        : ""}
        <div class="modal__actions">
          <button class="btn btn--ghost" data-r="0">${esc(cancelar)}</button>
          <button class="btn ${peligro ? "btn--danger" : "btn--ok"}" data-r="1" ${dobleConfirmacion ? "disabled" : ""}>${esc(ok)}</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("show"));

    const okBtn = ov.querySelector('[data-r="1"]');
    if (dobleConfirmacion) {
      ov.querySelector("#modal-doble").addEventListener("change", (e) => {
        okBtn.disabled = !e.target.checked;
      });
    }

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

// ---------- Sonido (WebAudio · sin assets externos) ----------

let audioCtx = null;
let muted = localStorage.getItem("guidos_mute") === "1";

export function isMuted() {
  return muted;
}
export function toggleMute() {
  muted = !muted;
  localStorage.setItem("guidos_mute", muted ? "1" : "0");
  return muted;
}
export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (_e) {
    /* audio no disponible */
  }
}
export function beep(kind = "new") {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const notas = kind === "urgent" ? [880, 1175, 880] : [660, 990];
    notas.forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      o.connect(g);
      g.connect(audioCtx.destination);
      const t = t0 + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.start(t);
      o.stop(t + 0.17);
    });
  } catch (_e) {
    /* silencioso */
  }
}

// ---------- Parpadeo del título de la pestaña ----------

let blinkTimer = null;
const tituloBase = document.title;
export function blinkTitulo(txt) {
  if (blinkTimer) return;
  let on = false;
  blinkTimer = setInterval(() => {
    document.title = on ? tituloBase : txt;
    on = !on;
  }, 900);
}
export function pararBlink() {
  if (blinkTimer) {
    clearInterval(blinkTimer);
    blinkTimer = null;
    document.title = tituloBase;
  }
}

// ---------- Pestañas ----------

export function activarTab(id) {
  document.querySelectorAll("[data-view]").forEach((v) => {
    v.classList.toggle("hidden", v.dataset.view !== id);
  });
  document.querySelectorAll("[data-tab]").forEach((t) => {
    const active = t.dataset.tab === id;
    t.classList.toggle("is-active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });
}

// ---------- Timers en vivo + reevaluación de semáforo ----------

export function refrescarTimers() {
  document.querySelectorAll("[data-desde]").forEach((el) => {
    const min = minutosDesde(el.dataset.desde);
    const t = el.querySelector(".t-min");
    if (t) t.textContent = textoMin(min);
    const estado = el.dataset.estado;
    if (estado) {
      const nivel = nivelSemaforo(estado, min);
      if (!el.classList.contains("sem-" + nivel)) {
        el.classList.remove("sem-ok", "sem-warn", "sem-urgent");
        el.classList.add("sem-" + nivel);
      }
    }
  });
}
