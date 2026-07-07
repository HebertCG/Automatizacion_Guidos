// ============================================================
//  Guido's · Reparto — render de tarjetas de entrega.
//  TODO valor dinámico (dirección, nombre, notas, agregado) viene
//  de WhatsApp = entrada NO confiable → pasa por esc() antes del DOM.
//  Los enlaces (maps/tel/wa) usan solo dígitos o encodeURIComponent.
// ============================================================

// ---------- Formato / seguridad ----------

// Escapa TODO texto antes de meterlo en innerHTML.
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

// Solo el número, sin "S/" (para el vuelto gigante).
export function montoPlano(n) {
  const x = Number(n) || 0;
  return x.toFixed(2);
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

// Teléfono listo para tel:/wa.me. Perú: si vienen 9 dígitos (celular
// local), se antepone el código de país 51.
export function telParaLink(phone) {
  let d = digits(phone);
  if (d.length === 9 && d.startsWith("9")) d = "51" + d;
  return d;
}

// ---------- Enlaces ----------

function mapsHref(o) {
  const lat = o.latitude == null ? NaN : Number(o.latitude);
  const lng = o.longitude == null ? NaN : Number(o.longitude);
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    // Navegación directa al pin.
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  // Sin pin: busca la dirección escrita.
  const q = encodeURIComponent(o.direccion || "");
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

// ---------- Fragmentos ----------

// Bloque de cobro: lo más importante para el motorizado. Semáforo:
// verde = ya pagado (Yape/Plin, no cobrar); ámbar = cobrar efectivo.
function cobroHtml(o) {
  const total = Number(o.total) || 0;

  if (o.metodo_pago === "yape" || o.metodo_pago === "plin") {
    const marca = o.metodo_pago === "plin" ? "Plin" : "Yape";
    return `<div class="cobro cobro--pagado">
      <div class="cobro__estado">✅ YA PAGADO (${esc(marca)})</div>
      <div class="cobro__nota">NO cobrar</div>
      <div class="cobro__monto">${soles(total)}</div>
    </div>`;
  }

  // Efectivo.
  const paga = o.paga_con == null ? null : Number(o.paga_con);
  if (paga != null && !Number.isNaN(paga) && paga > 0) {
    const vuelto = Math.max(0, paga - total);
    return `<div class="cobro cobro--cobrar">
      <div class="cobro__estado">💵 COBRAR ${soles(total)}</div>
      <div class="cobro__paga">Paga con <b>${soles(paga)}</b></div>
      <div class="cobro__vuelto">
        <span class="cobro__vuelto-lbl">LLEVAR VUELTO</span>
        <span class="cobro__vuelto-val">S/ ${esc(montoPlano(vuelto))}</span>
      </div>
    </div>`;
  }

  // Efectivo sin "paga con": monto exacto.
  return `<div class="cobro cobro--cobrar">
    <div class="cobro__estado">💵 COBRAR ${soles(total)}</div>
    <div class="cobro__nota cobro__nota--exacto">Monto exacto — sin vuelto</div>
  </div>`;
}

// Franja destacada: adicionales agregados al pedido. OJO: puede decir
// que hay un adicional que se cobra en efectivo aunque el pedido esté
// pagado con Yape (caso real del negocio).
function agregadoHtml(o) {
  if (!o.agregado_texto) return "";
  return `<div class="franja-agregado">
    <span class="franja-agregado__ico">➕</span>
    <span class="franja-agregado__txt">${esc(o.agregado_texto)}</span>
  </div>`;
}

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
  return `<details class="items">
    <summary class="items__sum">📦 Ver pedido (${items.length})</summary>
    <ul class="items__list">${filas}</ul>
  </details>`;
}

function contactoHtml(o) {
  const nombre = esc(o.cliente_nombre || "Cliente");
  const tel = telParaLink(o.cliente_phone);
  const botones = tel
    ? `<div class="contacto__btns">
         <a class="btn btn--contacto" href="tel:+${esc(tel)}">📞 Llamar</a>
         <a class="btn btn--contacto" target="_blank" rel="noopener noreferrer"
            href="https://wa.me/${esc(tel)}">💬 WhatsApp</a>
       </div>`
    : `<p class="contacto__sin">Sin teléfono registrado</p>`;
  return `<div class="contacto">
    <div class="contacto__nombre">👤 ${nombre}</div>
    ${botones}
  </div>`;
}

// ---------- Tarjeta ----------

export function tarjetaEntrega(o) {
  const pagado = o.metodo_pago === "yape" || o.metodo_pago === "plin";
  const min = minutosDesde(o.estado_desde);
  return `<article class="entrega ${pagado ? "entrega--pagado" : "entrega--cobrar"}"
      data-numero="${esc(o.numero)}" data-desde="${esc(o.estado_desde)}">
    <header class="entrega__top">
      <span class="entrega__num">#${esc(o.numero)}</span>
      <span class="entrega__timer" title="minutos en camino">
        ⏱ <span class="t-min">${esc(textoMin(min))}</span>
      </span>
    </header>

    ${cobroHtml(o)}
    ${agregadoHtml(o)}

    <div class="entrega__dir">
      <span class="entrega__dir-ico">📍</span>
      <div class="entrega__dir-txt">
        <span class="entrega__dir-calle">${esc(o.direccion || "Sin dirección")}</span>
        ${o.referencia ? `<span class="entrega__dir-ref">${esc(o.referencia)}</span>` : ""}
        ${o.zona ? `<span class="entrega__dir-zona">${esc(o.zona)}</span>` : ""}
      </div>
    </div>

    <a class="btn btn--maps" target="_blank" rel="noopener noreferrer" href="${mapsHref(o)}">
      🗺 IR CON GOOGLE MAPS
    </a>

    ${contactoHtml(o)}
    ${itemsHtml(o.items)}

    <div class="entrega__cierre">
      <button class="btn btn--entregado" data-action="entregado" data-numero="${esc(o.numero)}">
        ✔️ ENTREGADO
      </button>
      <button class="btn btn--planton" data-action="planton" data-numero="${esc(o.numero)}">
        ⚠️ Nadie respondió
      </button>
    </div>
  </article>`;
}
