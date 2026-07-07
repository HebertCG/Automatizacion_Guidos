// ============================================================
//  Guido's · Reparto — capa de datos del motorizado.
//  Lecturas por la vista `panel_pedidos` (SELECT a authenticated).
//  La ÚNICA vía para cambiar estado es la RPC accion_staff:
//  jamás un UPDATE directo a orders.
// ============================================================
import { sb } from "./supabase.js";

// Refresco de respaldo (además del tiempo real), en ms.
export const POLL_MS = 15000;

// ---------- Lecturas ----------

// Pedidos que ya son responsabilidad del motorizado (en_camino),
// del más antiguo al más nuevo (el que más espera va arriba).
export async function fetchEnCamino() {
  const { data, error } = await sb
    .from("panel_pedidos")
    .select("*")
    .eq("estado", "en_camino")
    .order("estado_desde", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Cuántos se entregaron hoy. La vista solo trae activos + finalizados
// de hoy, así que basta contar los que están en estado 'entregado'.
export async function contarEntregadosHoy() {
  const { count, error } = await sb
    .from("panel_pedidos")
    .select("numero", { count: "exact", head: true })
    .eq("estado", "entregado");
  if (error) throw error;
  return count ?? 0;
}

// ---------- Tiempo real ----------

// Cualquier cambio en `orders` dispara onChange (app.js hace refetch
// con debounce). Devuelve una función para cancelar la suscripción.
export function suscribirPedidos(onChange, onEstado) {
  const channel = sb
    .channel("reparto-orders")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      (payload) => onChange(payload)
    )
    .subscribe((status) => {
      if (typeof onEstado === "function") onEstado(status);
    });

  return () => sb.removeChannel(channel);
}

// ---------- Transición de estado (única vía permitida) ----------

// p_accion: 'entregado' | 'planton'. Devuelve { ok, mensaje }.
export async function accionStaff(accion, numero, actor) {
  const { data, error } = await sb.rpc("accion_staff", {
    p_accion: accion,
    p_numero: numero,
    p_actor: actor,
  });
  if (error) throw error;
  return data;
}
