// ============================================================
//  Guido's · Reparto — cliente Supabase del motorizado.
//  Reusa la MISMA anon key compartida (js/config.js): el secreto
//  vive en un solo lugar. Lo único propio aquí es el `storageKey`:
//  así la sesión del motorizado NO pisa la del staff aunque ambas
//  apps se sirvan desde el mismo dominio (mismo localStorage).
//  El UMD del CDN (index → reparto.html) expone window.supabase.
// ============================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error(
    "supabase-js no se cargó. Revisa el <script> del CDN en reparto.html."
  );
}

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // Clave de almacenamiento propia del reparto (independiente del panel).
    storageKey: "guidos-reparto-auth",
  },
});
