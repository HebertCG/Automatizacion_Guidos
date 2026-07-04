// ============================================================
//  Acciones del staff. Orquesta confirmaciones + RPC/UPDATE +
//  toast del mensaje devuelto. No refresca el tablero: eso lo
//  decide app.js tras un resultado exitoso.
// ============================================================
import {
  accionStaff,
  setDisponible,
  setPrecio,
  quitarPrepago,
} from "./data.js";
import { toast, confirmar } from "./ui.js";

// Confirmaciones específicas por acción destructiva.
async function confirmarAccion(accion, numero) {
  if (accion === "rechazar") {
    return confirmar({
      titulo: `Rechazar #${numero}`,
      mensaje: "El pedido se cancela y se avisa al cliente por WhatsApp.",
      ok: "Rechazar",
      peligro: true,
    });
  }
  if (accion === "pago_no") {
    return confirmar({
      titulo: `Voucher inválido · #${numero}`,
      mensaje: "El pedido vuelve a 'esperando pago' y se le pedirá el comprobante otra vez.",
      ok: "Marcar inválido",
      peligro: true,
    });
  }
  if (accion === "planton") {
    return confirmar({
      titulo: `Plantón · #${numero}`,
      mensaje:
        "El pedido se cancela y el cliente queda marcado como SOLO-PREPAGO para sus próximos pedidos.",
      ok: "Sí, fue plantón",
      peligro: true,
      dobleConfirmacion: true,
    });
  }
  return true; // aceptar / pago_ok / camino / entregado → un toque
}

export async function ejecutarAccion(accion, numero, email) {
  const ok = await confirmarAccion(accion, numero);
  if (!ok) return false;

  try {
    const res = await accionStaff(accion, numero, email);
    if (res && res.ok === false) {
      toast(res.mensaje || "No se pudo completar la acción.", "error");
      return false;
    }
    toast((res && res.mensaje) || "Listo.", "ok");
    return true;
  } catch (e) {
    toast("Error: " + (e?.message || e), "error");
    return false;
  }
}

export async function toggleDisponible(id, value) {
  try {
    await setDisponible(id, value);
    toast(value ? "Marcado disponible" : "Marcado agotado", "ok");
    return true;
  } catch (e) {
    toast("No se pudo actualizar la disponibilidad.", "error");
    return false;
  }
}

export async function guardarPrecio(id, price) {
  try {
    await setPrecio(id, price);
    toast("Precio actualizado", "ok");
    return true;
  } catch (e) {
    toast("No se pudo actualizar el precio.", "error");
    return false;
  }
}

export async function perdonarPrepago(id, nombre) {
  const ok = await confirmar({
    titulo: "Quitar solo-prepago",
    mensaje: `${nombre || "El cliente"} podrá volver a pagar contra entrega.`,
    ok: "Quitar",
  });
  if (!ok) return false;
  try {
    await quitarPrepago(id);
    toast("Cliente perdonado", "ok");
    return true;
  } catch (e) {
    toast("No se pudo actualizar el cliente.", "error");
    return false;
  }
}
