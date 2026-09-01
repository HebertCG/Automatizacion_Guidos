// ============================================================
//  Tiempo real: cualquier cambio en `orders` dispara onChange,
//  que en app.js provoca un refetch del tablero (con debounce).
//  La detección de "pedido nuevo / voucher por revisar" se hace
//  comparando snapshots en app.js, no con el payload del evento.
// ============================================================
import { sb } from "./supabase.js";
import { activo as demoActivo } from "./demo/demo-sesion.js";
import { suscribir as demoSuscribir } from "./demo/demo-store.js";

export function suscribirPedidos(onChange, onEstado) {
  // En demo el "tiempo real" lo emite el propio almacén al mutar.
  if (demoActivo()) {
    if (typeof onEstado === "function") onEstado("SUBSCRIBED");
    return demoSuscribir(onChange);
  }

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
