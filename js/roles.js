// ============================================================
//  Rol del usuario en sesión → "staff" | "reparto".
//  Orden de decisión:
//   1) metadata del usuario en Supabase Auth (app_metadata /
//      user_metadata .role) si está definida;
//   2) el mapa por email de config.js;
//   3) el rol por defecto (menor privilegio).
//  Editar cuentas: cambia ROLES_POR_EMAIL en js/config.js, o pon
//  { "role": "reparto" } en el user_metadata del usuario en Supabase.
// ============================================================
import { ROLES_POR_EMAIL, ROL_POR_DEFECTO } from "./config.js";

const ROLES_VALIDOS = new Set(["staff", "reparto"]);

export function rolDeSesion(session) {
  const u = session?.user;
  const meta = u?.app_metadata?.role || u?.user_metadata?.role;
  if (meta && ROLES_VALIDOS.has(meta)) return meta;

  const email = (u?.email || "").trim().toLowerCase();
  return ROLES_POR_EMAIL[email] || ROL_POR_DEFECTO;
}
