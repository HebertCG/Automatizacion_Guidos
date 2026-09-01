// ============================================================
//  Guido's · MODO DEMO — almacén en memoria.
//
//  Replica el contrato del backend real (vistas `panel_*` + la RPC
//  `accion_staff`) sin tocar la red. Sirve para recorrer el sistema
//  completo —panel de cocina y app de reparto— con datos de ejemplo.
//
//  La semilla se regenera en cada carga de la página: así los
//  cronómetros y el semáforo siempre arrancan con valores creíbles.
//  Los cambios que hace el usuario viven mientras dure la sesión.
// ============================================================
import {
  sembrarPedidos,
  sembrarClientes,
  sembrarMenu,
  sembrarConfig,
} from "./demo-datos.js";

const FINALIZADOS = new Set(["entregado", "cancelado"]);

const estado = {
  pedidos: sembrarPedidos(),
  clientes: sembrarClientes(),
  menu: sembrarMenu(),
  config: sembrarConfig(),
};

// ------------------------------------------------------------
//  Avisos de cambio (equivalente al Realtime de Supabase)
// ------------------------------------------------------------
const oyentes = new Set();

export function suscribir(onChange) {
  oyentes.add(onChange);
  return () => oyentes.delete(onChange);
}

function emitir() {
  for (const cb of oyentes) {
    try {
      cb({ demo: true });
    } catch {
      /* un oyente roto no debe tumbar a los demás */
    }
  }
}

// Copia defensiva: quien lee no puede mutar el almacén por accidente.
const copia = (v) => JSON.parse(JSON.stringify(v));

// ------------------------------------------------------------
//  Lecturas (equivalen a las vistas panel_*)
// ------------------------------------------------------------

export function pedidos() {
  return copia(
    [...estado.pedidos].sort(
      (a, b) => new Date(a.estado_desde) - new Date(b.estado_desde)
    )
  );
}

export function enCamino() {
  return copia(
    estado.pedidos
      .filter((o) => o.estado === "en_camino")
      .sort((a, b) => new Date(a.estado_desde) - new Date(b.estado_desde))
  );
}

export function entregadosHoy() {
  return estado.pedidos.filter((o) => o.estado === "entregado").length;
}

export function config() {
  return copia(estado.config);
}

export function menu() {
  return copia(
    [...estado.menu].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    )
  );
}

export function clientes({ search } = {}) {
  const t = String(search || "").trim().toLowerCase();
  const lista = estado.clientes.filter(
    (c) =>
      !t ||
      (c.name || "").toLowerCase().includes(t) ||
      (c.phone || "").includes(t)
  );
  return copia(
    [...lista].sort(
      (a, b) =>
        Number(b.solo_prepago) - Number(a.solo_prepago) ||
        b.plantones - a.plantones ||
        b.pedidos_ok - a.pedidos_ok
    )
  );
}

export function historial({ desde, hasta, estado: est, metodo, q, limit = 40, offset = 0 } = {}) {
  const t = String(q || "").trim().toLowerCase();
  let lista = estado.pedidos.filter((o) => {
    if (est && o.estado !== est) return false;
    if (metodo && o.metodo_pago !== metodo) return false;
    if (desde && o.created_at < `${desde}T00:00:00`) return false;
    if (hasta && o.created_at > `${hasta}T23:59:59`) return false;
    if (!t) return true;
    if (/^\d+$/.test(t)) {
      return String(o.numero) === t || (o.cliente_phone || "").includes(t);
    }
    return (
      (o.cliente_nombre || "").toLowerCase().includes(t) ||
      (o.cliente_phone || "").toLowerCase().includes(t)
    );
  });
  lista = lista.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return copia(lista.slice(offset, offset + limit));
}

// KPIs calculados igual que la vista `panel_kpis_hoy`: se recalculan
// en cada lectura, así el tablero reacciona a lo que hace el usuario.
export function kpis() {
  const p = estado.pedidos;
  const cuenta = (f) => p.filter(f).length;
  const entregados = p.filter((o) => o.estado === "entregado");
  const ventas = entregados.reduce((s, o) => s + Number(o.total || 0), 0);
  const minutos = (a, b) => (new Date(a) - new Date(b)) / 60000;

  const verificados = p.filter((o) => o.pago_verificado_at);
  const promedio = (arr) =>
    arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : null;

  const enCam = p.filter((o) => o.estado === "en_camino");

  return {
    pedidos_total: p.length,
    n_esperando_pago: cuenta((o) => o.estado === "esperando_pago"),
    n_pago_revision: cuenta((o) => o.estado === "pago_en_revision"),
    n_por_aceptar: cuenta((o) => o.estado === "por_aceptar"),
    n_en_cocina: cuenta((o) => o.estado === "en_cocina"),
    n_en_camino: enCam.length,
    n_entregado: entregados.length,
    n_cancelado: cuenta((o) => o.estado === "cancelado"),
    n_por_atender: cuenta((o) =>
      ["por_aceptar", "pago_en_revision"].includes(o.estado)
    ),
    ventas: Math.round(ventas * 100) / 100,
    ticket_promedio: entregados.length
      ? Math.round((ventas / entregados.length) * 100) / 100
      : 0,
    n_yape: cuenta((o) => o.metodo_pago === "yape"),
    n_plin: cuenta((o) => o.metodo_pago === "plin"),
    n_efectivo: cuenta((o) => o.metodo_pago === "efectivo"),
    n_validos: cuenta((o) => o.estado !== "cancelado"),
    min_verificar_pago: promedio(
      verificados.map((o) => minutos(o.pago_verificado_at, o.created_at))
    ),
    min_cocina: promedio(
      enCam.map((o) => minutos(o.estado_desde, o.pago_verificado_at || o.created_at))
    ),
    min_reparto: promedio(enCam.map((o) => minutos(Date.now(), o.estado_desde))),
  };
}

// ------------------------------------------------------------
//  Escrituras permitidas en el panel
// ------------------------------------------------------------

export function setDisponible(id, value) {
  const it = estado.menu.find((m) => String(m.id) === String(id));
  if (!it) throw new Error("Producto no encontrado en la demo.");
  it.is_available = Boolean(value);
  emitir();
  return true;
}

export function setPrecio(id, price) {
  const it = estado.menu.find((m) => String(m.id) === String(id));
  if (!it) throw new Error("Producto no encontrado en la demo.");
  it.price = Number(price);
  emitir();
  return true;
}

export function quitarPrepago(id) {
  const c = estado.clientes.find((x) => String(x.id) === String(id));
  if (!c) throw new Error("Cliente no encontrado en la demo.");
  c.solo_prepago = false;
  sincronizarCliente(c);
  emitir();
  return true;
}

// Los pedidos llevan copia de los datos del cliente (como la vista real,
// que hace join). Al cambiar el cliente hay que reflejarlo en sus pedidos.
function sincronizarCliente(c) {
  for (const o of estado.pedidos) {
    if (String(o.customer_id) !== String(c.id)) continue;
    o.cliente_solo_prepago = c.solo_prepago;
    o.cliente_plantones = c.plantones;
    o.cliente_pedidos_ok = c.pedidos_ok;
  }
}

// ------------------------------------------------------------
//  accion_staff — misma máquina de estados que en Postgres
// ------------------------------------------------------------

const no = (mensaje) => ({ ok: false, mensaje });
const si = (accion, numero, mensaje) => ({ ok: true, accion, numero, mensaje });

function codigoNuevo() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export function accionStaff(accion, numero, actor = "demo", codigo = null, rol = "staff") {
  // Mismo blindaje por rol que aplica la RLS en producción.
  if (rol === "reparto" && !["entregado", "planton"].includes(accion)) {
    return no("Esa acción es solo del staff.");
  }

  const o = estado.pedidos.find((x) => String(x.numero) === String(numero));
  if (!o) return no(`No existe el pedido #${numero}`);

  const ahora = new Date().toISOString();
  const exige = (esperado, verbo) =>
    o.estado !== esperado ? no(`#${numero} ${verbo} (está ${o.estado})`) : null;

  let err;
  switch (accion) {
    case "pago_ok":
      err = exige("pago_en_revision", "ya no está en revisión");
      if (err) return err;
      o.estado = "en_cocina";
      o.estado_desde = ahora;
      o.pago_verificado_por = actor;
      o.pago_verificado_at = ahora;
      break;

    case "pago_no":
      err = exige("pago_en_revision", "ya no está en revisión");
      if (err) return err;
      o.estado = "esperando_pago";
      o.estado_desde = ahora;
      o.pago_monto_detectado = null;
      o.pago_operacion = null;
      break;

    case "aceptar":
      err = exige("por_aceptar", "ya no está por aceptar");
      if (err) return err;
      o.estado = "en_cocina";
      o.estado_desde = ahora;
      break;

    case "rechazar":
      if (!["por_aceptar", "pago_en_revision", "esperando_pago"].includes(o.estado)) {
        return no(`#${numero} ya no se puede rechazar (está ${o.estado})`);
      }
      o.estado = "cancelado";
      o.estado_desde = ahora;
      o.cancel_reason = "rechazado por el local";
      break;

    case "camino":
      err = exige("en_cocina", "no está en cocina");
      if (err) return err;
      o.estado = "en_camino";
      o.estado_desde = ahora;
      // El código de entrega se genera aquí y se le manda al cliente
      // por WhatsApp; el motorizado lo pedirá al llegar.
      o.codigo_entrega = codigoNuevo();
      break;

    case "entregado": {
      err = exige("en_camino", "no está en camino");
      if (err) return err;
      // El motorizado SIEMPRE debe traer el código. El staff puede
      // cerrar sin él (por teléfono), igual que en producción.
      if (rol === "reparto") {
        if (!codigo) return no("Falta el código de entrega.");
        if (String(codigo) !== String(o.codigo_entrega)) {
          return no("Código incorrecto. Pídeselo otra vez al cliente.");
        }
      }
      o.estado = "entregado";
      o.estado_desde = ahora;
      o.es_activo = false;
      o.pago_cobrado = true;
      const c = estado.clientes.find((x) => String(x.id) === String(o.customer_id));
      if (c) {
        c.pedidos_ok += 1;
        sincronizarCliente(c);
      }
      emitir();
      return si(
        "entregado",
        numero,
        `🙌 Pedido #${numero} ENTREGADO${
          o.metodo_pago === "efectivo" ? " y cobrado en efectivo." : "."
        }`
      );
    }

    case "planton": {
      err = exige("en_camino", "no está en camino");
      if (err) return err;
      o.estado = "cancelado";
      o.estado_desde = ahora;
      o.es_activo = false;
      o.cancel_reason = "cliente no recibió el pedido";
      const c = estado.clientes.find((x) => String(x.id) === String(o.customer_id));
      if (c) {
        c.plantones += 1;
        c.solo_prepago = true;
        sincronizarCliente(c);
      }
      emitir();
      return si(
        "planton",
        numero,
        `⚠️ Plantón registrado en #${numero}. Ese cliente ahora solo podrá pedir con pago adelantado.`
      );
    }

    default:
      return no(`Acción desconocida: ${accion}`);
  }

  o.es_activo = !FINALIZADOS.has(o.estado);
  emitir();

  const textos = {
    pago_ok: `✅ Pago del #${numero} confirmado → EN COCINA. Cliente avisado.`,
    pago_no: `❌ Voucher del #${numero} rechazado. Se le pidió otra captura al cliente.`,
    aceptar: `✅ Pedido #${numero} aceptado → EN COCINA. Cliente avisado.`,
    rechazar: `❌ Pedido #${numero} rechazado y cancelado. Cliente avisado.`,
    camino: `🛵 Pedido #${numero} EN CAMINO. Código de entrega ${o.codigo_entrega} enviado al cliente.`,
  };
  return si(accion, numero, textos[accion] || "Listo.");
}
