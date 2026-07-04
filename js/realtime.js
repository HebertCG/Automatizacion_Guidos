// ============================================================
//  Tiempo real: cualquier cambio en `orders` dispara onChange,
//  que en app.js provoca un refetch del tablero (con debounce).
//  La detección de "pedido nuevo / voucher por revisar" se hace
//  comparando snapshots en app.js, no con el payload del evento.
// ============================================================
import { sb } from "./supabase.js";

export function suscribirPedidos(onChange, onEstado) {
  const channel = sb
    .channel("panel-orders")
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
