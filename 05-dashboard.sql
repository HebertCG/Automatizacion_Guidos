-- ============================================================
--  05-dashboard.sql  ·  Panel operativo Guido's
--  Vistas security_invoker + RLS de solo-lectura + grants.
--
--  Asume que YA existen: tablas base (orders, order_items,
--  customers, menu_items, menu_categories, guidos_config) y la
--  función RPC accion_staff(text, bigint, text).
--
--  Ejecutar en el SQL Editor de Supabase (rol postgres).
--  · NADA queda accesible para el rol `anon`.
--  · El bot n8n usa `service_role`, que ignora RLS/grants: no se
--    ve afectado por este script.
--  · accion_staff debe ser SECURITY DEFINER (así el staff puede
--    llamarla sin tener UPDATE sobre orders, que aquí se prohíbe).
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) VISTAS (security_invoker = true → respetan la RLS del que consulta)
-- ------------------------------------------------------------

-- Vista completa (una fila por pedido, con items en JSON y datos del cliente).
create or replace view public.panel_historial
with (security_invoker = true) as
select
  o.id, o.numero, o.estado, o.estado_desde, o.created_at,
  o.direccion, o.referencia, o.latitude, o.longitude, o.distancia_km,
  o.zona, o.delivery_fee, o.subtotal, o.total,
  o.metodo_pago, o.paga_con, o.pago_monto_detectado, o.pago_operacion,
  o.pago_verificado_por, o.pago_verificado_at, o.pago_cobrado,
  o.notas, o.cancel_reason,
  c.name         as cliente_nombre,
  c.phone        as cliente_phone,
  c.solo_prepago as cliente_solo_prepago,
  c.plantones    as cliente_plantones,
  c.pedidos_ok   as cliente_pedidos_ok,
  coalesce((
    select json_agg(json_build_object(
      'nombre', oi.nombre,
      'cantidad', oi.cantidad,
      'precio_unit', oi.precio_unit,
      'notas', oi.notas,
      'subtotal', oi.subtotal
    ) order by oi.nombre)
    from public.order_items oi
    where oi.order_id = o.id
  ), '[]'::json) as items,
  (o.estado not in ('entregado','cancelado')) as es_activo,
  ((o.created_at at time zone 'America/Lima')::date
     = (now() at time zone 'America/Lima')::date) as es_hoy
from public.orders o
left join public.customers c on c.id = o.customer_id;

-- Tablero: activos + finalizados de hoy (consulta frecuente y liviana).
create or replace view public.panel_pedidos
with (security_invoker = true) as
select * from public.panel_historial
where es_activo or es_hoy;

-- KPIs de hoy (calculados en SQL, no en el cliente).
create or replace view public.panel_kpis_hoy
with (security_invoker = true) as
with h as (
  select * from public.orders o
  where (o.created_at at time zone 'America/Lima')::date
        = (now() at time zone 'America/Lima')::date
)
select
  count(*)                                              as pedidos_total,
  count(*) filter (where estado = 'esperando_pago')     as n_esperando_pago,
  count(*) filter (where estado = 'pago_en_revision')   as n_pago_revision,
  count(*) filter (where estado = 'por_aceptar')        as n_por_aceptar,
  count(*) filter (where estado = 'en_cocina')          as n_en_cocina,
  count(*) filter (where estado = 'en_camino')          as n_en_camino,
  count(*) filter (where estado = 'entregado')          as n_entregado,
  count(*) filter (where estado = 'cancelado')          as n_cancelado,
  count(*) filter (where estado in ('por_aceptar','pago_en_revision')) as n_por_atender,
  coalesce(sum(total) filter (where estado = 'entregado'), 0)          as ventas,
  coalesce(
    sum(total) filter (where estado = 'entregado')
    / nullif(count(*) filter (where estado = 'entregado'), 0), 0)      as ticket_promedio,
  count(*) filter (where metodo_pago = 'yape')          as n_yape,
  count(*) filter (where metodo_pago = 'plin')          as n_plin,
  count(*) filter (where metodo_pago = 'efectivo')      as n_efectivo,
  count(*) filter (where estado <> 'cancelado')         as n_validos,
  -- Tiempo hasta verificar el pago (created_at → pago_verificado_at). Exacto.
  round(avg(extract(epoch from (pago_verificado_at - created_at)) / 60.0)
        filter (where pago_verificado_at is not null))  as min_verificar_pago,
  -- Tiempo en cocina de los pedidos que YA salieron (proxy, ver nota abajo).
  round(avg(extract(epoch from (estado_desde - coalesce(pago_verificado_at, created_at))) / 60.0)
        filter (where estado = 'en_camino'))            as min_cocina,
  -- Tiempo actual en reparto de los pedidos en camino.
  round(avg(extract(epoch from (now() - estado_desde)) / 60.0)
        filter (where estado = 'en_camino'))            as min_reparto
from h;
-- NOTA: sin una tabla de historial de transiciones (que el enunciado
-- prohíbe inventar), sólo `min_verificar_pago` es un promedio "cerrado"
-- exacto. `min_cocina`/`min_reparto` son aproximaciones a partir de
-- estado_desde y pago_verificado_at. Para promedios históricos precisos
-- de cocina/reparto haría falta registrar cada transición (fuera de alcance).

-- Carta con nombre de categoría.
create or replace view public.panel_menu
with (security_invoker = true) as
select
  mi.id, mi.category_id, mi.name, mi.description, mi.price, mi.is_available,
  mc.name as categoria, mc.sort_order
from public.menu_items mi
left join public.menu_categories mc on mc.id = mi.category_id;

-- Clientes (subconjunto necesario para el panel).
create or replace view public.panel_clientes
with (security_invoker = true) as
select id, name, phone, pedidos_ok, plantones, solo_prepago
from public.customers;

-- Config (fila única). `select *` para no depender de qué columnas wd_* existan.
create or replace view public.panel_config
with (security_invoker = true) as
select * from public.guidos_config where id = 1;

-- ------------------------------------------------------------
-- 2) RLS: solo lectura para `authenticated` en las tablas base
-- ------------------------------------------------------------
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.customers       enable row level security;
alter table public.menu_items      enable row level security;
alter table public.menu_categories enable row level security;
alter table public.guidos_config   enable row level security;

drop policy if exists panel_select_orders on public.orders;
create policy panel_select_orders on public.orders
  for select to authenticated using (true);

drop policy if exists panel_select_order_items on public.order_items;
create policy panel_select_order_items on public.order_items
  for select to authenticated using (true);

drop policy if exists panel_select_customers on public.customers;
create policy panel_select_customers on public.customers
  for select to authenticated using (true);

drop policy if exists panel_select_menu_items on public.menu_items;
create policy panel_select_menu_items on public.menu_items
  for select to authenticated using (true);

drop policy if exists panel_select_menu_categories on public.menu_categories;
create policy panel_select_menu_categories on public.menu_categories
  for select to authenticated using (true);

drop policy if exists panel_select_config on public.guidos_config;
create policy panel_select_config on public.guidos_config
  for select to authenticated using (true);

-- UPDATE acotado en menu_items (solo disponibilidad y precio).
drop policy if exists panel_update_menu on public.menu_items;
create policy panel_update_menu on public.menu_items
  for update to authenticated using (true) with check (true);

-- UPDATE acotado en customers (solo quitar solo_prepago).
drop policy if exists panel_update_customers on public.customers;
create policy panel_update_customers on public.customers
  for update to authenticated using (true) with check (true);

-- ------------------------------------------------------------
-- 3) GRANTS  (authenticated puede; anon NO)
-- ------------------------------------------------------------

-- Vistas: SELECT solo para authenticated.
grant select on
  public.panel_pedidos, public.panel_historial, public.panel_kpis_hoy,
  public.panel_menu, public.panel_clientes, public.panel_config
to authenticated;

revoke all on
  public.panel_pedidos, public.panel_historial, public.panel_kpis_hoy,
  public.panel_menu, public.panel_clientes, public.panel_config
from anon;

-- Tablas base: las vistas security_invoker requieren SELECT del que consulta.
grant select on
  public.orders, public.order_items, public.customers,
  public.menu_items, public.menu_categories, public.guidos_config
to authenticated;

revoke all on
  public.orders, public.order_items, public.customers,
  public.menu_items, public.menu_categories, public.guidos_config
from anon;

-- Escrituras acotadas a nivel de columna (además de la RLS de arriba).
revoke insert, update, delete on public.menu_items from authenticated;
grant  update (is_available, price) on public.menu_items to authenticated;

revoke insert, update, delete on public.customers from authenticated;
grant  update (solo_prepago) on public.customers to authenticated;

-- ------------------------------------------------------------
-- 4) RPC: solo authenticated puede ejecutar accion_staff.
-- ------------------------------------------------------------
revoke execute on function public.accion_staff(text, bigint, text) from public, anon;
grant  execute on function public.accion_staff(text, bigint, text) to authenticated;

-- ------------------------------------------------------------
-- 5) Realtime: publica cambios de `orders` (idempotente).
-- ------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;

commit;
