// ============================================================
//  Orquestador del panel Guido's.
//  - Sesión / login / logout
//  - Carga inicial + refresco (tiempo real + respaldo 20s)
//  - Tablero por pestañas, KPIs, carta, clientes, historial
//  - Notificaciones (sonido + parpadeo de título) por diffing
// ============================================================
import * as auth from "./auth.js";
import * as data from "./data.js";
import * as render from "./render.js";
import * as ui from "./ui.js";
import * as actions from "./actions.js";
import { suscribirPedidos } from "./realtime.js";
import { REFRESH_MS, UMBRALES_DEFAULT } from "./config.js";

const state = {
  activo: false,
  email: "",
  pedidos: [],
  kpis: null,
  tab: "por_atender",
  snapshotAtencion: new Set(),
  snapshotInit: false,
  timers: { backup: null, tick: null, debounce: null },
  unsub: null,
};

// ---------- Umbrales del semáforo desde guidos_config ----------

function construirUmbrales(cfg) {
  const u = JSON.parse(JSON.stringify(UMBRALES_DEFAULT));
  if (cfg) {
    const set = (estado, campo, valor) => {
      if (valor != null && !Number.isNaN(Number(valor))) u[estado][campo] = Number(valor);
    };
    set("pago_en_revision", "alerta", cfg.wd_revision_alerta_min);
    set("pago_en_revision", "urgente", cfg.wd_revision_urgente_min);
    set("por_aceptar", "alerta", cfg.wd_aceptar_alerta_min);
    set("por_aceptar", "urgente", cfg.wd_aceptar_urgente_min);
    set("en_cocina", "alerta", cfg.wd_cocina_alerta_min);
    set("en_cocina", "urgente", cfg.wd_cocina_urgente_min);
    set("en_camino", "alerta", cfg.wd_camino_alerta_min);
    set("en_camino", "urgente", cfg.wd_camino_urgente_min);
    set("esperando_pago", "alerta", cfg.wd_esperando_alerta_min);
    set("esperando_pago", "urgente", cfg.wd_esperando_urgente_min);
  }
  for (const k in u) {
    if (u[k].urgente <= u[k].alerta) u[k].urgente = u[k].alerta + 5;
  }
  return u;
}

// ---------- Pintado del tablero ----------

function porFecha(asc) {
  return (a, b) =>
    asc
      ? new Date(a.estado_desde) - new Date(b.estado_desde)
      : new Date(b.estado_desde) - new Date(a.estado_desde);
}

function setList(view, arr, vacio = "Nada por aquí 🙌") {
  const el = document.querySelector(`[data-list="${view}"]`);
  if (!el) return;
  el.innerHTML = arr.length
    ? arr.map(render.tarjetaPedido).join("")
    : `<p class="empty">${vacio}</p>`;
}

function setBadge(tab, n) {
  const b = document.querySelector(`[data-tab="${tab}"] .tab-badge`);
  if (!b) return;
  b.textContent = n ? String(n) : "";
  b.classList.toggle("hidden", !n);
}

function pintarTablero() {
  const p = state.pedidos;
  const porAtender = p
    .filter((o) => o.estado === "por_aceptar" || o.estado === "pago_en_revision")
    .sort(porFecha(true)); // el que más espera, arriba
  const esperando = p.filter((o) => o.estado === "esperando_pago").sort(porFecha(true));
  const cocina = p.filter((o) => o.estado === "en_cocina").sort(porFecha(true));
  const camino = p.filter((o) => o.estado === "en_camino").sort(porFecha(true));
  const hoy = p
    .filter((o) => (o.estado === "entregado" || o.estado === "cancelado") && o.es_hoy)
    .sort(porFecha(false));

  setList("por_atender", porAtender, "Sin pendientes urgentes ✅");
  setList("esperando", esperando, "Nadie esperando pago");
  setList("cocina", cocina, "Cocina despejada");
  setList("camino", camino, "Nada en reparto");
  setList("hoy", hoy, "Aún no hay pedidos cerrados hoy");

  setBadge("por_atender", porAtender.length);
  setBadge("esperando", esperando.length);
  setBadge("cocina", cocina.length);
  setBadge("camino", camino.length);
}

// ---------- Notificaciones por diffing ----------

function detectarNuevos(pedidos) {
  const atencion = new Set(
    pedidos
      .filter((o) => o.estado === "por_aceptar" || o.estado === "pago_en_revision")
      .map((o) => o.numero)
  );
  let hayNuevo = false;
  for (const n of atencion) if (!state.snapshotAtencion.has(n)) hayNuevo = true;

  if (hayNuevo && state.snapshotInit) {
    ui.beep("new");
    if (document.hidden) ui.blinkTitulo("🔔 ¡Pedido nuevo! · Guido's");
  }
  state.snapshotAtencion = atencion;
  state.snapshotInit = true;
}

// ---------- Refresco ----------

function marcarOnline(ok) {
  const el = document.getElementById("offline");
  if (el) el.classList.toggle("hidden", ok);
}

async function refrescar() {
  try {
    const [pedidos, kpis] = await Promise.all([data.fetchPedidos(), data.fetchKpis()]);
    state.pedidos = pedidos;
    state.kpis = kpis;
    detectarNuevos(pedidos);
    pintarTablero();
    const kpisEl = document.getElementById("kpis");
    if (kpisEl) kpisEl.innerHTML = render.renderKpis(kpis);
    ui.refrescarTimers();
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

// ---------- Pestañas y cargas perezosas ----------

async function cambiarTab(tab) {
  state.tab = tab;
  ui.activarTab(tab);
  ui.pararBlink();
  if (tab === "carta") await cargarMenu();
  if (tab === "historial") {
    await cargarHistorial();
    await cargarClientes();
  }
}

async function cargarMenu() {
  const cont = document.getElementById("menu-cont");
  if (cont) cont.innerHTML = `<p class="empty">Cargando carta…</p>`;
  try {
    const items = await data.fetchMenu();
    if (cont) cont.innerHTML = render.renderMenu(items);
  } catch (e) {
    if (cont) cont.innerHTML = `<p class="empty">No se pudo cargar la carta.</p>`;
  }
}

function leerFiltrosHist() {
  return {
    desde: document.getElementById("f-desde")?.value || "",
    hasta: document.getElementById("f-hasta")?.value || "",
    estado: document.getElementById("f-estado")?.value || "",
    metodo: document.getElementById("f-metodo")?.value || "",
    q: document.getElementById("f-q")?.value || "",
  };
}

async function cargarHistorial() {
  const cont = document.getElementById("hist-cont");
  if (cont) cont.innerHTML = `<p class="empty">Cargando…</p>`;
  try {
    const list = await data.fetchHistorial(leerFiltrosHist());
    if (cont) cont.innerHTML = render.renderHistorial(list);
  } catch (e) {
    if (cont) cont.innerHTML = `<p class="empty">No se pudo cargar el historial.</p>`;
  }
}

async function cargarClientes() {
  const cont = document.getElementById("cli-cont");
  if (cont) cont.innerHTML = `<p class="empty">Cargando…</p>`;
  try {
    const q = document.getElementById("cli-search")?.value || "";
    const list = await data.fetchClientes({ search: q });
    if (cont) cont.innerHTML = render.renderClientes(list);
  } catch (e) {
    if (cont) cont.innerHTML = `<p class="empty">No se pudieron cargar los clientes.</p>`;
  }
}

// ---------- Entrar / salir ----------

function actualizarMute(m) {
  const b = document.getElementById("btn-mute");
  if (b) {
    b.textContent = m ? "🔕" : "🔔";
    b.setAttribute("aria-label", m ? "Activar sonido" : "Silenciar");
    b.classList.toggle("is-muted", m);
  }
}

export async function arrancar(session) {
  if (state.activo) return;
  state.activo = true;
  state.email = auth.currentEmail(session);

  const who = document.getElementById("user-email");
  if (who) who.textContent = state.email;
  actualizarMute(ui.isMuted());

  try {
    const cfg = await data.fetchConfig();
    ui.setUmbrales(construirUmbrales(cfg));
    const marca = document.getElementById("marca-nombre");
    if (marca && cfg?.name) marca.textContent = cfg.name;
  } catch (_e) {
    ui.setUmbrales(construirUmbrales(null));
  }

  await refrescar();
  ui.activarTab(state.tab);

  state.unsub = suscribirPedidos(debouncedRefresh);
  state.timers.backup = setInterval(refrescar, REFRESH_MS);
  state.timers.tick = setInterval(ui.refrescarTimers, 1000);
}

export function detener() {
  state.activo = false;
  state.snapshotInit = false;
  state.snapshotAtencion = new Set();
  if (state.unsub) {
    state.unsub();
    state.unsub = null;
  }
  clearInterval(state.timers.backup);
  clearInterval(state.timers.tick);
  clearTimeout(state.timers.debounce);
  ui.pararBlink();
}

// ---------- Eventos ----------

function wireEventos() {
  // Clicks del panel (delegados dentro de #app; el login y el logout
  // los maneja el router de sesión).
  document.getElementById("app").addEventListener("click", async (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) return cambiarTab(tab.dataset.tab);

    const seg = e.target.closest("[data-seg]");
    if (seg) {
      const grupo = seg.closest(".seg");
      grupo.querySelectorAll("[data-seg]").forEach((b) => b.classList.toggle("is-active", b === seg));
      document.querySelectorAll("[data-segview]").forEach((v) => {
        v.classList.toggle("hidden", v.dataset.segview !== seg.dataset.seg);
      });
      return;
    }

    const act = e.target.closest("[data-action]");
    if (act) {
      act.disabled = true;
      const ok = await actions.ejecutarAccion(
        act.dataset.action,
        Number(act.dataset.numero),
        state.email
      );
      if (ok) await refrescar();
      else act.disabled = false;
      return;
    }

    const perdon = e.target.closest("[data-perdon]");
    if (perdon) {
      const ok = await actions.perdonarPrepago(perdon.dataset.perdon, perdon.dataset.nombre);
      if (ok) await cargarClientes();
      return;
    }

    if (e.target.closest("#btn-mute")) {
      ui.unlockAudio();
      actualizarMute(ui.toggleMute());
      return;
    }
    if (e.target.closest("#hist-aplicar")) return cargarHistorial();
    if (e.target.closest("#cli-buscar")) return cargarClientes();
  });

  // Carta: toggle disponible (con rollback si falla)
  document.addEventListener("change", async (e) => {
    const disp = e.target.closest(".disp-toggle");
    if (disp) {
      const ok = await actions.toggleDisponible(disp.dataset.id, disp.checked);
      if (!ok) disp.checked = !disp.checked;
      else disp.closest(".menu-item")?.classList.toggle("is-off", !disp.checked);
    }
  });

  // Carta: guardar precio al salir del input o con Enter
  document.addEventListener(
    "blur",
    async (e) => {
      const inp = e.target.closest?.(".precio-input");
      if (!inp) return;
      const val = parseFloat(inp.value);
      if (!Number.isNaN(val) && val >= 0) await actions.guardarPrecio(inp.dataset.id, val);
    },
    true
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList?.contains("precio-input")) e.target.blur();
  });

  // Buscar historial/clientes con Enter
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (e.target.id === "f-q") cargarHistorial();
    if (e.target.id === "cli-search") cargarClientes();
  });

  // Parar parpadeo del título al volver a la pestaña
  window.addEventListener("focus", ui.pararBlink);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) ui.pararBlink();
  });
  // Desbloquear audio al primer gesto (política de autoplay)
  window.addEventListener("pointerdown", ui.unlockAudio, { once: true });
  window.addEventListener("online", () => marcarOnline(true));
  window.addEventListener("offline", () => marcarOnline(false));
}

// ---------- Arranque ----------

// El router de sesión (js/session-router.js) decide el rol y llama a
// arrancar()/detener(). Aquí solo cableamos los eventos del panel una vez.
wireEventos();
