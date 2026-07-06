// ============================================================
//  Render: construye el HTML de tarjetas, KPIs, carta, clientes
//  e historial. Todo valor dinámico pasa por esc() para evitar
//  XSS (los textos vienen de WhatsApp = entrada no confiable).
// ============================================================
import {
  esc,
  soles,
  digits,
  minutosDesde,
  textoMin,
  nivelSemaforo,
  nombreEstado,
  fechaCorta,
} from "./ui.js";

// ---------- Fragmentos reutilizables ----------

function itemsHtml(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const filas = items
    .map(
      (it) =>
        `<li><span class="qty">${esc(it.cantidad)}×</span> ${esc(it.nombre)}${
          it.notas ? ` <em>(${esc(it.notas)})</em>` : ""
        }</li>`
    )
    .join("");
  return `<ul class="card__items">${filas}</ul>`;
}

function mapsLink(o) {
  if (o.latitude == null || o.longitude == null) return "";
  const lat = Number(o.latitude);
  const lng = Number(o.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return "";
  return `<a class="chip chip--link" target="_blank" rel="noopener noreferrer" href="https://maps.google.com/?q=${lat},${lng}">🗺 Mapa</a>`;
}

function waLink(phone) {
  const tel = digits(phone);
  if (!tel) return "";
  return `<a class="wa" target="_blank" rel="noopener noreferrer" href="https://wa.me/${tel}">📱 ${esc(phone)}</a>`;
}

function pagoRevisionHtml(o) {
  const esperado = Number(o.total) || 0;
  const detectado = o.pago_monto_detectado == null ? null : Number(o.pago_monto_detectado);
  const coincide = detectado != null && Math.abs(detectado - esperado) < 0.5;
  const clase = detectado == null ? "verif--sin" : coincide ? "verif--ok" : "verif--warn";
  const flag =
    detectado == null ? "sin dato" : coincide ? "✓ coincide" : "⚠ no coincide";
  return `<div class="verif ${clase}">
    <div class="verif__row"><span>Esperado</span><b>${soles(esperado)}</b></div>
    <div class="verif__row"><span>IA leyó</span><b>${detectado == null ? "—" : soles(detectado)}</b><span class="verif__flag">${flag}</span></div>
    ${o.pago_operacion ? `<div class="verif__op">Operación ${esc(o.pago_operacion)}</div>` : ""}
  </div>`;
}

function pagoBadge(o) {
  if (o.metodo_pago === "efectivo") {
    const paga = Number(o.paga_con) || 0;
    const total = Number(o.total) || 0;
    const detalle =
      paga > 0
        ? ` · paga con ${soles(paga)} → vuelto <b>${soles(paga - total)}</b>`
        : "";
    return `<div class="pay pay--cash">💵 Efectivo${detalle}</div>`;
  }
  const label = o.metodo_pago === "plin" ? "Plin" : "Yape";
  return `<div class="pay pay--yape">💜 ${label}${
    o.pago_operacion ? ` · op ${esc(o.pago_operacion)}` : ""
  }</div>`;
}

function agregadoHtml(o) {
  if (!o.agregado_texto) return "";
  if (o.estado === "entregado" || o.estado === "cancelado") return "";
  const min = minutosDesde(o.agregado_at);
  const fresco = min != null && min < 10;
  return `<div class="card__agregado ${fresco ? "card__agregado--nuevo" : ""}">
    <b>➕ Agregado${min != null ? ` hace ${esc(textoMin(min))}` : ""}</b>
    <span>${esc(o.agregado_texto)}</span>
  </div>`;
}

function btn(accion, numero, label, variant) {
  return `<button class="btn btn--${variant}" data-action="${esc(accion)}" data-numero="${esc(
    numero
  )}">${esc(label)}</button>`;
}

function botonesHtml(o) {
  const n = o.numero;
  let arr = [];
  switch (o.estado) {
    case "pago_en_revision":
      arr = [btn("pago_ok", n, "✅ Pago OK", "ok"), btn("pago_no", n, "❌ Voucher inválido", "danger")];
      break;
    case "por_aceptar":
      arr = [btn("aceptar", n, "✅ Aceptar", "ok"), btn("rechazar", n, "❌ Rechazar", "danger")];
      break;
    case "en_cocina":
      arr = [btn("camino", n, "🛵 Salió en camino", "go")];
      break;
    case "en_camino":
      arr = [btn("entregado", n, "✔️ Entregado", "ok"), btn("planton", n, "⚠️ Nadie recibió", "danger")];
      break;
    default:
      return "";
  }
  return `<div class="card__actions">${arr.join("")}</div>`;
}

// ---------- Tarjeta de pedido ----------

export function tarjetaPedido(o) {
  const min = minutosDesde(o.estado_desde);
  const nivel = nivelSemaforo(o.estado, min);
  const finalizado = o.estado === "entregado" || o.estado === "cancelado";
  return `<article class="card estado-${esc(o.estado)} ${finalizado ? "card--fin" : "sem-" + nivel}"
      data-desde="${esc(o.estado_desde)}" data-estado="${esc(o.estado)}" data-numero="${esc(o.numero)}">
    <header class="card__top">
      <span class="card__num">#${esc(o.numero)}</span>
      <span class="card__timer" title="minutos en este estado">⏱ <span class="t-min">${esc(textoMin(min))}</span></span>
      <span class="estado-chip">${esc(nombreEstado(o.estado))}</span>
    </header>
    ${agregadoHtml(o)}
    <div class="card__cliente"><b>${esc(o.cliente_nombre || "—")}</b> ${waLink(o.cliente_phone)}
      ${o.cliente_solo_prepago ? `<span class="tag tag--rojo">solo prepago</span>` : ""}</div>
    ${itemsHtml(o.items)}
    <div class="card__dir">📍 ${esc(o.direccion || "—")}${
      o.referencia ? ` · <span class="ref">${esc(o.referencia)}</span>` : ""
    }</div>
    <div class="card__meta">${mapsLink(o)}<span class="chip">${esc(o.zona || "sin zona")}</span><span class="chip">Delivery ${soles(o.delivery_fee)}</span></div>
    ${o.notas ? `<div class="card__notas">📝 ${esc(o.notas)}</div>` : ""}
    ${o.estado === "cancelado" && o.cancel_reason ? `<div class="card__cancel">✖ ${esc(o.cancel_reason)}</div>` : ""}
    ${o.estado === "pago_en_revision" ? pagoRevisionHtml(o) : ""}
    <div class="card__total"><span>TOTAL</span><b>${soles(o.total)}</b></div>
    ${pagoBadge(o)}
    ${botonesHtml(o)}
  </article>`;
}

// ---------- KPIs ----------

function kpi(label, val, cls = "") {
  return `<div class="kpi ${cls}"><span class="kpi__v">${esc(val)}</span><span class="kpi__l">${esc(label)}</span></div>`;
}

export function renderKpis(k) {
  if (!k) return "";
  const pct = (n) => (k.n_validos ? Math.round((100 * (Number(n) || 0)) / k.n_validos) : 0);
  const min = (v) => (v == null ? "—" : `${v}m`);
  return [
    kpi("Pedidos hoy", k.pedidos_total ?? 0),
    kpi("Por atender", k.n_por_atender ?? 0, (k.n_por_atender ?? 0) > 0 ? "kpi--alerta" : ""),
    kpi("Ventas", soles(k.ventas), "kpi--money"),
    kpi("Ticket", soles(k.ticket_promedio)),
    kpi("Yape", `${pct(k.n_yape)}%`),
    kpi("Efectivo", `${pct(k.n_efectivo)}%`),
    kpi("⏱ Verif. pago", min(k.min_verificar_pago)),
    kpi("⏱ Cocina", min(k.min_cocina)),
    kpi("⏱ Reparto", min(k.min_reparto)),
    kpi("En cocina", k.n_en_cocina ?? 0),
    kpi("En camino", k.n_en_camino ?? 0),
    kpi("Entregados", k.n_entregado ?? 0),
  ].join("");
}

// ---------- Carta ----------

export function renderMenu(items) {
  if (!Array.isArray(items) || items.length === 0)
    return `<p class="empty">No hay productos en la carta.</p>`;
  const groups = new Map();
  for (const it of items) {
    const cat = it.categoria || "Otros";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(it);
  }
  let html = "";
  for (const [cat, arr] of groups) {
    html += `<section class="menu-cat"><h3 class="menu-cat__t">${esc(cat)}</h3>${arr
      .map(filaMenu)
      .join("")}</section>`;
  }
  return html;
}

function filaMenu(it) {
  const precio = Number(it.price);
  return `<div class="menu-item ${it.is_available ? "" : "is-off"}" data-id="${esc(it.id)}">
    <div class="menu-item__info">
      <b>${esc(it.name)}</b>
      ${it.description ? `<span class="menu-item__desc">${esc(it.description)}</span>` : ""}
    </div>
    <div class="menu-item__price">S/ <input class="precio-input" type="number" inputmode="decimal" step="0.5" min="0"
        value="${esc(Number.isNaN(precio) ? "" : precio.toFixed(2))}" data-id="${esc(it.id)}" aria-label="Precio de ${esc(it.name)}"></div>
    <label class="switch" title="disponible / agotado">
      <input type="checkbox" class="disp-toggle" data-id="${esc(it.id)}" ${it.is_available ? "checked" : ""} aria-label="Disponible: ${esc(it.name)}">
      <span class="switch__track"><span class="switch__thumb"></span></span>
    </label>
  </div>`;
}

// ---------- Clientes ----------

export function renderClientes(list) {
  if (!Array.isArray(list) || list.length === 0)
    return `<p class="empty">Sin clientes.</p>`;
  return list
    .map(
      (c) => `<div class="cliente ${c.solo_prepago ? "cliente--prepago" : ""}" data-id="${esc(c.id)}">
      <div class="cliente__info">
        <div class="cliente__top"><b>${esc(c.name || "—")}</b>${
        c.solo_prepago ? `<span class="tag tag--rojo">solo prepago</span>` : ""
      }</div>
        ${waLink(c.phone)}
        <span class="cliente__stats">✅ ${esc(c.pedidos_ok || 0)} ok · 🚫 ${esc(c.plantones || 0)} plantones</span>
      </div>
      ${
        c.solo_prepago
          ? `<button class="btn btn--sm btn--warn" data-perdon="${esc(c.id)}" data-nombre="${esc(c.name || "")}">Quitar prepago</button>`
          : `<span class="ok-badge">OK</span>`
      }
    </div>`
    )
    .join("");
}

// ---------- Historial ----------

export function renderHistorial(list) {
  if (!Array.isArray(list) || list.length === 0)
    return `<p class="empty">Sin pedidos con esos filtros.</p>`;
  return list
    .map(
      (o) => `<details class="hrow estado-${esc(o.estado)}">
      <summary>
        <span class="hrow__num">#${esc(o.numero)}</span>
        <span class="hrow__cli">${esc(o.cliente_nombre || "—")}</span>
        <span class="estado-chip">${esc(nombreEstado(o.estado))}</span>
        <span class="hrow__total">${soles(o.total)}</span>
        <span class="hrow__fecha">${esc(fechaCorta(o.created_at))}</span>
      </summary>
      <div class="hrow__body">
        ${itemsHtml(o.items)}
        <div class="card__dir">📍 ${esc(o.direccion || "—")}${
        o.referencia ? ` · ${esc(o.referencia)}` : ""
      }</div>
        ${pagoBadge(o)}
        ${o.cancel_reason ? `<div class="card__cancel">✖ ${esc(o.cancel_reason)}</div>` : ""}
      </div>
    </details>`
    )
    .join("");
}
