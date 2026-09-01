// ============================================================
//  Capa de datos. TODA lectura pasa por vistas security_invoker.
//  TODA transición de estado pasa por la RPC accion_staff
//  (jamás un UPDATE directo de orders.estado).
//  Solo hay UPDATE directo en menu_items (disponible/precio) y
//  customers (quitar solo_prepago), permitidos por RLS.
//
//  MODO DEMO: si la sesión es de demostración, cada función se
//  atiende con el almacén en memoria (js/demo/demo-store.js) y no
//  se toca la red. La forma de lo que se devuelve es idéntica.
// ============================================================
import { sb } from "./supabase.js";
import { activo as demoActivo } from "./demo/demo-sesion.js";
import * as demo from "./demo/demo-store.js";

// Limpia texto libre antes de meterlo en un filtro .or() de PostgREST.
function safeLike(t) {
  return String(t || "").trim().replace(/[,.()*%]/g, "");
}

// ---------- Lecturas ----------

// Pedidos activos + los finalizados de hoy (para tablero y pestaña "Hoy").
export async function fetchPedidos() {
  if (demoActivo()) return demo.pedidos();
  const { data, error } = await sb
    .from("panel_pedidos")
    .select("*")
    .order("estado_desde", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchKpis() {
  if (demoActivo()) return demo.kpis();
  const { data, error } = await sb.from("panel_kpis_hoy").select("*").maybeSingle();
  if (error) throw error;
  return data ?? {};
}

export async function fetchConfig() {
  if (demoActivo()) return demo.config();
  const { data, error } = await sb.from("panel_config").select("*").maybeSingle();
  if (error) throw error;
  return data ?? {};
}

export async function fetchMenu() {
  if (demoActivo()) return demo.menu();
  const { data, error } = await sb
    .from("panel_menu")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchClientes({ search } = {}) {
  if (demoActivo()) return demo.clientes({ search });
  let q = sb
    .from("panel_clientes")
    .select("*")
    .order("solo_prepago", { ascending: false })
    .order("plantones", { ascending: false })
    .order("pedidos_ok", { ascending: false })
    .limit(120);

  const t = safeLike(search);
  if (t) q = q.or(`name.ilike.%${t}%,phone.ilike.%${t}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchHistorial({
  desde,
  hasta,
  estado,
  metodo,
  q,
  limit = 40,
  offset = 0,
} = {}) {
  if (demoActivo())
    return demo.historial({ desde, hasta, estado, metodo, q, limit, offset });

  let query = sb
    .from("panel_historial")
    .select("*")
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);
  if (metodo) query = query.eq("metodo_pago", metodo);
  if (desde) query = query.gte("created_at", `${desde}T00:00:00`);
  if (hasta) query = query.lte("created_at", `${hasta}T23:59:59`);

  const t = safeLike(q);
  if (t) {
    if (/^\d+$/.test(t)) {
      query = query.or(`numero.eq.${t},cliente_phone.ilike.%${t}%`);
    } else {
      query = query.or(`cliente_nombre.ilike.%${t}%,cliente_phone.ilike.%${t}%`);
    }
  }

  query = query.range(offset, offset + limit - 1);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------- Escrituras permitidas (RLS) ----------

export async function setDisponible(id, value) {
  if (demoActivo()) return demo.setDisponible(id, value);
  const { error } = await sb.from("menu_items").update({ is_available: value }).eq("id", id);
  if (error) throw error;
  return true;
}

export async function setPrecio(id, price) {
  if (demoActivo()) return demo.setPrecio(id, price);
  const { error } = await sb.from("menu_items").update({ price }).eq("id", id);
  if (error) throw error;
  return true;
}

export async function quitarPrepago(id) {
  if (demoActivo()) return demo.quitarPrepago(id);
  const { error } = await sb.from("customers").update({ solo_prepago: false }).eq("id", id);
  if (error) throw error;
  return true;
}

// ---------- Transiciones de estado (única vía permitida) ----------

export async function accionStaff(accion, numero, actor) {
  if (demoActivo()) return demo.accionStaff(accion, numero, actor, null, "staff");

  const { data, error } = await sb.rpc("accion_staff", {
    p_accion: accion,
    p_numero: numero,
    p_actor: actor,
  });
  if (error) throw error;
  return data; // { ok, mensaje }
}
