// ============================================================
//  Cliente Supabase (v2, cargado por CDN en index.html).
//  El UMD del CDN expone window.supabase; aquí creamos el
//  cliente de la app y lo exportamos como `sb`.
// ============================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error(
    "supabase-js no se cargó. Revisa el <script> del CDN en index.html."
  );
}

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
