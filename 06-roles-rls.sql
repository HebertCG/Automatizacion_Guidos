-- ============================================================
--  06-roles-rls.sql  ·  Separación DURA por rol (staff | reparto)
--
--  Qué hace:
--   1) Crea la tabla public.staff_roles (usuario → rol).
--   2) Asigna el rol a las cuentas existentes por email.
--   3) Helpers mi_rol() / es_staff() (security definer).
--   4) RLS por rol en las tablas base:
--        - staff  → ve y edita todo (como hoy).
--        - reparto→ SOLO lee pedidos en_camino (+ los entregados de
--          hoy, para el contador). No ve carta, config ni clientes
--          fuera de sus entregas; no puede editar precios/clientes.
--   5) Blinda accion_staff: si la llama un usuario autenticado con
--      rol 'reparto', solo permite 'entregado' y 'planton'.
--
--  Seguro para el bot n8n: usa service_role, que IGNORA RLS. Además,
--  cuando accion_staff la llama el bot no hay auth.uid(), así que el
--  control de rol se salta y el bot sigue haciendo todo.
--
--  Ejecutar en el SQL Editor de Supabase (rol postgres). Idempotente.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) TABLA DE ROLES
-- ------------------------------------------------------------
create table if not exists public.staff_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  rol        text not null check (rol in ('staff','reparto')),
  created_at timestamptz not null default now()
);

-- RLS activa y SIN políticas para authenticated: nadie la lee directo
-- desde el navegador; solo las funciones security definer (mi_rol) y el
-- service_role pueden verla.
alter table public.staff_roles enable row level security;

-- ------------------------------------------------------------
-- 2) ASIGNAR ROLES A LAS CUENTAS EXISTENTES (por email, sin UIDs a mano)
-- ------------------------------------------------------------
insert into public.staff_roles (user_id, rol)
select id, 'staff' from auth.users where lower(email) = 'staff@guidos.pe'
on conflict (user_id) do update set rol = excluded.rol;

insert into public.staff_roles (user_id, rol)
select id, 'reparto' from auth.users where lower(email) = 'motorizado@guidos.pe'
on conflict (user_id) do update set rol = excluded.rol;

-- ------------------------------------------------------------
-- 3) HELPERS (security definer → leen staff_roles saltándose la RLS)
-- ------------------------------------------------------------
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.staff_roles where user_id = auth.uid();
$$;

create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'staff' from public.staff_roles where user_id = auth.uid()), false);
$$;

revoke execute on function public.mi_rol()  from public, anon;
revoke execute on function public.es_staff() from public, anon;
grant  execute on function public.mi_rol()  to authenticated;
grant  execute on function public.es_staff() to authenticated;

-- ------------------------------------------------------------
-- 4) RLS POR ROL EN LAS TABLAS BASE
--    (las vistas son security_invoker → respetan estas políticas)
-- ------------------------------------------------------------

-- ORDERS: staff todo; reparto solo en_camino + entregados de hoy.
drop policy if exists panel_select_orders on public.orders;
drop policy if exists rol_select_orders   on public.orders;
create policy rol_select_orders on public.orders
  for select to authenticated
  using (
    public.es_staff()
    or estado = 'en_camino'
    or (estado = 'entregado'
        and (created_at at time zone 'America/Lima')::date
            = (now() at time zone 'America/Lima')::date)
  );

-- ORDER_ITEMS: reparto solo los ítems de los pedidos que puede ver.
drop policy if exists panel_select_order_items on public.order_items;
drop policy if exists rol_select_order_items   on public.order_items;
create policy rol_select_order_items on public.order_items
  for select to authenticated
  using (
    public.es_staff()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.estado = 'en_camino'
             or (o.estado = 'entregado'
                 and (o.created_at at time zone 'America/Lima')::date
                     = (now() at time zone 'America/Lima')::date))
    )
  );

-- CUSTOMERS: reparto solo los clientes de los pedidos que puede ver.
drop policy if exists panel_select_customers on public.customers;
drop policy if exists rol_select_customers   on public.customers;
create policy rol_select_customers on public.customers
  for select to authenticated
  using (
    public.es_staff()
    or exists (
      select 1 from public.orders o
      where o.customer_id = customers.id
        and (o.estado = 'en_camino'
             or (o.estado = 'entregado'
                 and (o.created_at at time zone 'America/Lima')::date
                     = (now() at time zone 'America/Lima')::date))
    )
  );

-- MENU / CATEGORÍAS / CONFIG: solo staff (el reparto no los necesita).
drop policy if exists panel_select_menu_items on public.menu_items;
drop policy if exists rol_select_menu_items   on public.menu_items;
create policy rol_select_menu_items on public.menu_items
  for select to authenticated using (public.es_staff());

drop policy if exists panel_select_menu_categories on public.menu_categories;
drop policy if exists rol_select_menu_categories   on public.menu_categories;
create policy rol_select_menu_categories on public.menu_categories
  for select to authenticated using (public.es_staff());

drop policy if exists panel_select_config on public.guidos_config;
drop policy if exists rol_select_config   on public.guidos_config;
create policy rol_select_config on public.guidos_config
  for select to authenticated using (public.es_staff());

-- UPDATE de carta (precio/disponible): solo staff.
drop policy if exists panel_update_menu on public.menu_items;
drop policy if exists rol_update_menu   on public.menu_items;
create policy rol_update_menu on public.menu_items
  for update to authenticated using (public.es_staff()) with check (public.es_staff());

-- UPDATE de clientes (quitar solo_prepago): solo staff.
drop policy if exists panel_update_customers on public.customers;
drop policy if exists rol_update_customers   on public.customers;
create policy rol_update_customers on public.customers
  for update to authenticated using (public.es_staff()) with check (public.es_staff());

-- ------------------------------------------------------------
-- 5) BLINDAR accion_staff POR ROL
--    Mismo cuerpo que en 03-crons.sql + control de rol al inicio.
--    - Bot (service_role, sin auth.uid()) → sin restricción.
--    - Usuario 'reparto' → solo 'entregado' | 'planton'.
--    - Usuario 'staff'   → todas las acciones.
-- ------------------------------------------------------------
create or replace function public.accion_staff(
  p_accion text,
  p_numero bigint,
  p_actor  text default 'staff'
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_o   record;
  v_rol text;
begin
  -- Control de rol: solo cuando la llama un usuario autenticado (no el bot).
  if auth.uid() is not null then
    v_rol := public.mi_rol();
    if v_rol is null then
      return json_build_object('ok', false, 'mensaje',
        'Tu usuario no tiene un rol asignado. Avisa al administrador.');
    end if;
    if v_rol = 'reparto' and p_accion not in ('entregado','planton') then
      return json_build_object('ok', false, 'mensaje',
        'Esa acción es solo del staff.');
    end if;
  end if;

  select o.*, c.id as cid, c.phone as cliente_phone into v_o
  from orders o join customers c on c.id = o.customer_id
  where o.numero = p_numero;

  if not found then
    return json_build_object('ok', false, 'mensaje', 'No existe el pedido #' || p_numero);
  end if;

  if p_accion = 'pago_ok' then
    if v_o.estado <> 'pago_en_revision' then
      return json_build_object('ok', false, 'mensaje',
        '#' || p_numero || ' ya no está en revisión (está ' || v_o.estado || ')');
    end if;
    update orders set estado = 'en_cocina',
      pago_verificado_por = p_actor, pago_verificado_at = now()
    where id = v_o.id;
    return json_build_object('ok', true, 'accion', 'pago_ok', 'numero', p_numero,
      'mensaje', '✅ Pago del #' || p_numero || ' confirmado → EN COCINA. Cliente avisado.');

  elsif p_accion = 'pago_no' then
    if v_o.estado <> 'pago_en_revision' then
      return json_build_object('ok', false, 'mensaje',
        '#' || p_numero || ' ya no está en revisión (está ' || v_o.estado || ')');
    end if;
    update orders set estado = 'esperando_pago',
      pago_monto_detectado = null, pago_operacion = null
    where id = v_o.id;
    return json_build_object('ok', true, 'accion', 'pago_no', 'numero', p_numero,
      'mensaje', '❌ Voucher del #' || p_numero || ' rechazado. Se le pidió otra captura al cliente.');

  elsif p_accion = 'aceptar' then
    if v_o.estado <> 'por_aceptar' then
      return json_build_object('ok', false, 'mensaje',
        '#' || p_numero || ' ya no está por aceptar (está ' || v_o.estado || ')');
    end if;
    update orders set estado = 'en_cocina' where id = v_o.id;
    return json_build_object('ok', true, 'accion', 'aceptar', 'numero', p_numero,
      'mensaje', '✅ Pedido #' || p_numero || ' aceptado → EN COCINA. Cliente avisado.');

  elsif p_accion = 'rechazar' then
    if v_o.estado not in ('por_aceptar','pago_en_revision','esperando_pago') then
      return json_build_object('ok', false, 'mensaje',
        '#' || p_numero || ' ya no se puede rechazar (está ' || v_o.estado || ')');
    end if;
    update orders set estado = 'cancelado',
      cancel_reason = 'rechazado por el local' where id = v_o.id;
    return json_build_object('ok', true, 'accion', 'rechazar', 'numero', p_numero,
      'mensaje', '❌ Pedido #' || p_numero || ' rechazado y cancelado. Cliente avisado.');

  elsif p_accion = 'camino' then
    if v_o.estado <> 'en_cocina' then
      return json_build_object('ok', false, 'mensaje',
        '#' || p_numero || ' no está en cocina (está ' || v_o.estado || ')');
    end if;
    update orders set estado = 'en_camino' where id = v_o.id;
    return json_build_object('ok', true, 'accion', 'camino', 'numero', p_numero,
      'mensaje', '🛵 Pedido #' || p_numero || ' EN CAMINO. Cliente avisado.');

  elsif p_accion = 'entregado' then
    if v_o.estado <> 'en_camino' then
      return json_build_object('ok', false, 'mensaje',
        '#' || p_numero || ' no está en camino (está ' || v_o.estado || ')');
    end if;
    update orders set estado = 'entregado',
      pago_cobrado = true where id = v_o.id;
    update customers set pedidos_ok = pedidos_ok + 1 where id = v_o.cid;
    return json_build_object('ok', true, 'accion', 'entregado', 'numero', p_numero,
      'mensaje', '🙌 Pedido #' || p_numero || ' ENTREGADO' ||
        case when v_o.metodo_pago = 'efectivo' then ' y cobrado en efectivo.' else '.' end);

  elsif p_accion = 'planton' then
    if v_o.estado <> 'en_camino' then
      return json_build_object('ok', false, 'mensaje',
        '#' || p_numero || ' no está en camino (está ' || v_o.estado || ')');
    end if;
    update orders set estado = 'cancelado',
      cancel_reason = 'cliente no recibió el pedido' where id = v_o.id;
    update customers set plantones = plantones + 1,
      solo_prepago = true where id = v_o.cid;
    return json_build_object('ok', true, 'accion', 'planton', 'numero', p_numero,
      'mensaje', '⚠️ Plantón registrado en #' || p_numero ||
        '. Ese cliente ahora solo podrá pedir con pago adelantado.');

  else
    return json_build_object('ok', false, 'mensaje', 'Acción desconocida: ' || p_accion);
  end if;
end $$;

-- Permisos de ejecución (create or replace los conserva, pero los fijamos).
revoke execute on function public.accion_staff(text, bigint, text) from public, anon;
grant  execute on function public.accion_staff(text, bigint, text) to authenticated, service_role;

commit;

-- ------------------------------------------------------------
--  VERIFICAR (opcional, corre aparte después del commit):
--
--  select u.email, r.rol
--  from public.staff_roles r
--  join auth.users u on u.id = r.user_id
--  order by r.rol;
--
--  AGREGAR un repartidor nuevo más adelante:
--  insert into public.staff_roles (user_id, rol)
--  select id, 'reparto' from auth.users where lower(email) = 'motorizado2@guidos.pe'
--  on conflict (user_id) do update set rol = excluded.rol;
-- ------------------------------------------------------------
