// ============================================================
//  Guido's · MODO DEMO — datos de ejemplo.
//
//  Semilla de un turno típico del local. Se genera SIEMPRE relativa
//  a la hora actual (`haceMin`), así los cronómetros y el semáforo
//  de cada tarjeta se ven vivos sin importar cuándo se abra la demo.
//
//  Nada de esto toca Supabase: son objetos en memoria con la misma
//  forma que devuelven las vistas `panel_*` de producción.
// ============================================================

const haceMin = (m) => new Date(Date.now() - m * 60000).toISOString();
const dos = (n) => Math.round(n * 100) / 100;

// ------------------------------------------------------------
//  Carta
// ------------------------------------------------------------
export function sembrarMenu() {
  return [
    { id: 1, category_id: 1, categoria: "Pollo a la brasa", sort_order: 1, name: "Pollo entero + papas + ensalada", description: "Pollo a la brasa entero con papas y ensalada para 4", price: 62, is_available: true },
    { id: 2, category_id: 1, categoria: "Pollo a la brasa", sort_order: 1, name: "Medio pollo + papas", description: "Con ensalada y cremas", price: 34, is_available: true },
    { id: 3, category_id: 1, categoria: "Pollo a la brasa", sort_order: 1, name: "Cuarto de pollo + papas", description: "Porción personal", price: 19, is_available: true },
    { id: 4, category_id: 2, categoria: "Parrillas", sort_order: 2, name: "Anticuchos (2 palos)", description: "Con papa dorada y choclo", price: 24, is_available: true },
    { id: 5, category_id: 2, categoria: "Parrillas", sort_order: 2, name: "Alitas BBQ (8 u.)", description: "Bañadas en salsa de la casa", price: 28, is_available: true },
    { id: 6, category_id: 2, categoria: "Parrillas", sort_order: 2, name: "Parrilla familiar", description: "Res, pollo, chorizo y anticucho", price: 89, is_available: false },
    { id: 7, category_id: 3, categoria: "Criollos", sort_order: 3, name: "Lomo saltado", description: "Con arroz y papas fritas", price: 27, is_available: true },
    { id: 8, category_id: 3, categoria: "Criollos", sort_order: 3, name: "Arroz chaufa de pollo", description: "Al wok", price: 22, is_available: true },
    { id: 9, category_id: 3, categoria: "Criollos", sort_order: 3, name: "Ají de gallina", description: "Con arroz blanco y papa", price: 21, is_available: true },
    { id: 10, category_id: 4, categoria: "Bebidas", sort_order: 4, name: "Chicha morada 1 L", description: "De la casa, sin azúcar añadida", price: 10, is_available: true },
    { id: 11, category_id: 4, categoria: "Bebidas", sort_order: 4, name: "Inca Kola 1.5 L", description: "", price: 12, is_available: true },
    { id: 12, category_id: 4, categoria: "Bebidas", sort_order: 4, name: "Gaseosa personal", description: "500 ml", price: 5, is_available: true },
    { id: 13, category_id: 5, categoria: "Extras", sort_order: 5, name: "Porción de papas", description: "", price: 9, is_available: true },
    { id: 14, category_id: 5, categoria: "Extras", sort_order: 5, name: "Cremas extra", description: "Ají, mayonesa y ketchup", price: 3, is_available: false },
  ];
}

// ------------------------------------------------------------
//  Clientes
// ------------------------------------------------------------
export function sembrarClientes() {
  return [
    { id: 1, name: "Rosa Quispe", phone: "51987654321", pedidos_ok: 14, plantones: 0, solo_prepago: false },
    { id: 2, name: "Luis Mendoza", phone: "51961234567", pedidos_ok: 6, plantones: 0, solo_prepago: false },
    { id: 3, name: "Carmen Ríos", phone: "51935778812", pedidos_ok: 21, plantones: 1, solo_prepago: false },
    { id: 4, name: "Jorge Ttito", phone: "51944556677", pedidos_ok: 2, plantones: 3, solo_prepago: true },
    { id: 5, name: "Milagros Ayala", phone: "51999112233", pedidos_ok: 9, plantones: 0, solo_prepago: false },
    { id: 6, name: "Elena Chávez", phone: "51922334455", pedidos_ok: 4, plantones: 0, solo_prepago: false },
    { id: 7, name: "Diego Salazar", phone: "51977889900", pedidos_ok: 11, plantones: 0, solo_prepago: false },
    { id: 8, name: "Andrea Poma", phone: "51966554433", pedidos_ok: 1, plantones: 0, solo_prepago: false },
    { id: 9, name: "Raúl Vilca", phone: "51933221100", pedidos_ok: 17, plantones: 0, solo_prepago: false },
  ];
}

// ------------------------------------------------------------
//  Configuración del local (equivale a `guidos_config`)
// ------------------------------------------------------------
export function sembrarConfig() {
  return {
    name: "GUIDO'S",
    wd_revision_alerta_min: 5,
    wd_revision_urgente_min: 15,
    wd_aceptar_alerta_min: 5,
    wd_aceptar_urgente_min: 12,
    wd_cocina_alerta_min: 40,
    wd_cocina_urgente_min: 55,
    wd_camino_alerta_min: 45,
    wd_camino_urgente_min: 60,
    wd_esperando_alerta_min: 10,
    wd_esperando_urgente_min: 25,
  };
}

// ------------------------------------------------------------
//  Pedidos
//
//  La lista cubre TODOS los estados de la máquina, para que el
//  panel muestre cada pestaña con contenido y cada color del
//  semáforo: verde, ámbar y rojo.
// ------------------------------------------------------------
function pedido(base) {
  const subtotal = dos(base.items.reduce((s, it) => s + it.precio_unit * it.cantidad, 0));
  const delivery_fee = base.delivery_fee ?? 5;
  return {
    latitude: null,
    longitude: null,
    referencia: null,
    notas: null,
    paga_con: null,
    pago_monto_detectado: null,
    pago_operacion: null,
    pago_verificado_por: null,
    pago_verificado_at: null,
    pago_cobrado: false,
    cancel_reason: null,
    codigo_entrega: null,
    agregado_texto: null,
    agregado_at: null,
    es_hoy: true,
    ...base,
    delivery_fee,
    subtotal,
    total: dos(subtotal + delivery_fee),
    es_activo: !["entregado", "cancelado"].includes(base.estado),
    items: base.items.map((it) => ({ ...it, subtotal: dos(it.precio_unit * it.cantidad) })),
  };
}

export function sembrarPedidos() {
  return [
    // ---- Por atender: vouchers esperando que el staff los confirme ----
    pedido({
      id: 1048, numero: 1048, estado: "pago_en_revision",
      created_at: haceMin(4), estado_desde: haceMin(3),
      cliente_nombre: "Rosa Quispe", cliente_phone: "51987654321",
      cliente_solo_prepago: false, cliente_plantones: 0, cliente_pedidos_ok: 14,
      customer_id: 1,
      direccion: "Av. La Cultura 1842, dpto 302", referencia: "Frente al parque",
      latitude: -13.5265, longitude: -71.9413, distancia_km: 2.4, zona: "Wanchaq",
      metodo_pago: "yape",
      // La IA de n8n leyó el voucher y el monto CUADRA con el total.
      pago_monto_detectado: 81, pago_operacion: "00318472",
      items: [
        { nombre: "Pollo entero + papas + ensalada", cantidad: 1, precio_unit: 62, notas: null },
        { nombre: "Chicha morada 1 L", cantidad: 1, precio_unit: 10, notas: null },
        { nombre: "Cremas extra", cantidad: 1, precio_unit: 3, notas: "harto ají" },
      ],
      delivery_fee: 6,
    }),
    pedido({
      id: 1047, numero: 1047, estado: "pago_en_revision",
      created_at: haceMin(11), estado_desde: haceMin(9),
      cliente_nombre: "Luis Mendoza", cliente_phone: "51961234567",
      cliente_solo_prepago: false, cliente_plantones: 0, cliente_pedidos_ok: 6,
      customer_id: 2,
      direccion: "Calle Belén 512", referencia: "Portón verde",
      latitude: -13.5198, longitude: -71.9762, distancia_km: 3.1, zona: "Santiago",
      metodo_pago: "yape",
      // Voucher que NO cuadra: el panel lo marca "⚠ no coincide".
      pago_monto_detectado: 20, pago_operacion: "00318455",
      items: [
        { nombre: "Medio pollo + papas", cantidad: 1, precio_unit: 34, notas: null },
        { nombre: "Gaseosa personal", cantidad: 2, precio_unit: 5, notas: null },
      ],
    }),
    pedido({
      id: 1046, numero: 1046, estado: "por_aceptar",
      created_at: haceMin(3), estado_desde: haceMin(2),
      cliente_nombre: "Carmen Ríos", cliente_phone: "51935778812",
      cliente_solo_prepago: false, cliente_plantones: 1, cliente_pedidos_ok: 21,
      customer_id: 3,
      direccion: "Urb. Magisterio D-7", referencia: "Casa de dos pisos, reja negra",
      latitude: -13.5142, longitude: -71.9538, distancia_km: 1.8, zona: "Magisterio",
      metodo_pago: "efectivo", paga_con: 100,
      items: [
        { nombre: "Parrilla familiar", cantidad: 1, precio_unit: 89, notas: "término tres cuartos" },
      ],
      delivery_fee: 5,
    }),
    pedido({
      id: 1045, numero: 1045, estado: "por_aceptar",
      created_at: haceMin(9), estado_desde: haceMin(8),
      cliente_nombre: "Milagros Ayala", cliente_phone: "51999112233",
      cliente_solo_prepago: false, cliente_plantones: 0, cliente_pedidos_ok: 9,
      customer_id: 5,
      direccion: "Av. Perú 233, of. 2", referencia: null,
      latitude: -13.5301, longitude: -71.9455, distancia_km: 2.9, zona: "Wanchaq",
      metodo_pago: "plin", pago_operacion: "77120934",
      items: [
        { nombre: "Lomo saltado", cantidad: 2, precio_unit: 27, notas: null },
        { nombre: "Inca Kola 1.5 L", cantidad: 1, precio_unit: 12, notas: null },
      ],
    }),

    // ---- Esperando que el cliente mande el voucher ----
    pedido({
      id: 1044, numero: 1044, estado: "esperando_pago",
      created_at: haceMin(16), estado_desde: haceMin(16),
      cliente_nombre: "Jorge Ttito", cliente_phone: "51944556677",
      cliente_solo_prepago: true, cliente_plantones: 3, cliente_pedidos_ok: 2,
      customer_id: 4,
      direccion: "Prolongación Av. Grau 980", referencia: "Al lado de la bodega",
      latitude: -13.5233, longitude: -71.9821, distancia_km: 4.2, zona: "Santiago",
      metodo_pago: "yape",
      notas: "Cliente solo-prepago: cobrar antes de mandar.",
      items: [
        { nombre: "Cuarto de pollo + papas", cantidad: 2, precio_unit: 19, notas: null },
      ],
      delivery_fee: 7,
    }),

    // ---- En cocina ----
    pedido({
      id: 1043, numero: 1043, estado: "en_cocina",
      created_at: haceMin(30), estado_desde: haceMin(24),
      cliente_nombre: "Elena Chávez", cliente_phone: "51922334455",
      cliente_solo_prepago: false, cliente_plantones: 0, cliente_pedidos_ok: 4,
      customer_id: 6,
      direccion: "Jr. Ayacucho 145", referencia: "Tercer piso",
      latitude: -13.5177, longitude: -71.9789, distancia_km: 2.2, zona: "Centro",
      metodo_pago: "yape", pago_operacion: "00318401",
      pago_verificado_por: "staff@guidos.pe", pago_verificado_at: haceMin(24),
      items: [
        { nombre: "Alitas BBQ (8 u.)", cantidad: 2, precio_unit: 28, notas: "una sin picante" },
        { nombre: "Porción de papas", cantidad: 1, precio_unit: 9, notas: null },
      ],
    }),
    pedido({
      id: 1042, numero: 1042, estado: "en_cocina",
      created_at: haceMin(52), estado_desde: haceMin(47),
      cliente_nombre: "Diego Salazar", cliente_phone: "51977889900",
      cliente_solo_prepago: false, cliente_plantones: 0, cliente_pedidos_ok: 11,
      customer_id: 7,
      direccion: "Av. Tomasa Ttito 455", referencia: "Edificio azul",
      latitude: -13.5388, longitude: -71.9294, distancia_km: 5.6, zona: "San Sebastián",
      metodo_pago: "efectivo", paga_con: 50,
      // Lleva 47 min en cocina → el semáforo lo pone en rojo con pulso.
      items: [
        { nombre: "Ají de gallina", cantidad: 1, precio_unit: 21, notas: null },
        { nombre: "Arroz chaufa de pollo", cantidad: 1, precio_unit: 22, notas: "sin cebolla china" },
      ],
      delivery_fee: 8,
    }),

    // ---- En camino: lo que ve el motorizado ----
    pedido({
      id: 1041, numero: 1041, estado: "en_camino",
      created_at: haceMin(38), estado_desde: haceMin(13),
      cliente_nombre: "Andrea Poma", cliente_phone: "51966554433",
      cliente_solo_prepago: false, cliente_plantones: 0, cliente_pedidos_ok: 1,
      customer_id: 8,
      direccion: "Calle Saphi 720", referencia: "Casa con portón de madera",
      latitude: -13.5109, longitude: -71.9822, distancia_km: 2.7, zona: "Centro",
      metodo_pago: "efectivo", paga_con: 100,
      codigo_entrega: "48213",
      // Franja roja en la app de reparto: el cliente agregó algo después.
      agregado_texto: "Agregar 1 chicha morada de litro (ya está incluida en el total)",
      agregado_at: haceMin(6),
      items: [
        { nombre: "Pollo entero + papas + ensalada", cantidad: 1, precio_unit: 62, notas: null },
        { nombre: "Chicha morada 1 L", cantidad: 1, precio_unit: 10, notas: null },
      ],
      delivery_fee: 5,
    }),
    pedido({
      id: 1040, numero: 1040, estado: "en_camino",
      created_at: haceMin(70), estado_desde: haceMin(34),
      cliente_nombre: "Raúl Vilca", cliente_phone: "51933221100",
      cliente_solo_prepago: false, cliente_plantones: 0, cliente_pedidos_ok: 17,
      customer_id: 9,
      direccion: "Av. Los Incas 1204", referencia: "Frente al grifo",
      latitude: -13.5254, longitude: -71.9601, distancia_km: 3.4, zona: "Wanchaq",
      metodo_pago: "yape", pago_operacion: "00318377",
      pago_verificado_por: "staff@guidos.pe", pago_verificado_at: haceMin(58),
      codigo_entrega: "70956",
      items: [
        { nombre: "Anticuchos (2 palos)", cantidad: 2, precio_unit: 24, notas: null },
        { nombre: "Gaseosa personal", cantidad: 2, precio_unit: 5, notas: null },
      ],
      delivery_fee: 6,
    }),

    // ---- Cerrados hoy ----
    pedido({
      id: 1039, numero: 1039, estado: "entregado",
      created_at: haceMin(95), estado_desde: haceMin(58),
      cliente_nombre: "Rosa Quispe", cliente_phone: "51987654321",
      cliente_solo_prepago: false, cliente_plantones: 0, cliente_pedidos_ok: 14,
      customer_id: 1,
      direccion: "Av. La Cultura 1842, dpto 302", referencia: "Frente al parque",
      latitude: -13.5265, longitude: -71.9413, distancia_km: 2.4, zona: "Wanchaq",
      metodo_pago: "yape", pago_operacion: "00318290", pago_cobrado: true,
      pago_verificado_por: "staff@guidos.pe", pago_verificado_at: haceMin(91),
      codigo_entrega: "31877",
      items: [{ nombre: "Medio pollo + papas", cantidad: 1, precio_unit: 34, notas: null }],
    }),
    pedido({
      id: 1038, numero: 1038, estado: "entregado",
      created_at: haceMin(128), estado_desde: haceMin(82),
      cliente_nombre: "Carmen Ríos", cliente_phone: "51935778812",
      cliente_solo_prepago: false, cliente_plantones: 1, cliente_pedidos_ok: 21,
      customer_id: 3,
      direccion: "Urb. Magisterio D-7", referencia: null,
      latitude: -13.5142, longitude: -71.9538, distancia_km: 1.8, zona: "Magisterio",
      metodo_pago: "efectivo", paga_con: 60, pago_cobrado: true,
      codigo_entrega: "10244",
      items: [
        { nombre: "Lomo saltado", cantidad: 1, precio_unit: 27, notas: null },
        { nombre: "Inca Kola 1.5 L", cantidad: 1, precio_unit: 12, notas: null },
      ],
    }),
    pedido({
      id: 1037, numero: 1037, estado: "entregado",
      created_at: haceMin(155), estado_desde: haceMin(119),
      cliente_nombre: "Milagros Ayala", cliente_phone: "51999112233",
      cliente_solo_prepago: false, cliente_plantones: 0, cliente_pedidos_ok: 9,
      customer_id: 5,
      direccion: "Av. Perú 233, of. 2", referencia: null,
      latitude: -13.5301, longitude: -71.9455, distancia_km: 2.9, zona: "Wanchaq",
      metodo_pago: "plin", pago_operacion: "77120801", pago_cobrado: true,
      pago_verificado_por: "staff@guidos.pe", pago_verificado_at: haceMin(150),
      codigo_entrega: "62509",
      items: [
        { nombre: "Arroz chaufa de pollo", cantidad: 2, precio_unit: 22, notas: null },
        { nombre: "Chicha morada 1 L", cantidad: 1, precio_unit: 10, notas: null },
      ],
    }),
    pedido({
      id: 1036, numero: 1036, estado: "cancelado",
      created_at: haceMin(180), estado_desde: haceMin(132),
      cliente_nombre: "Jorge Ttito", cliente_phone: "51944556677",
      cliente_solo_prepago: true, cliente_plantones: 3, cliente_pedidos_ok: 2,
      customer_id: 4,
      direccion: "Prolongación Av. Grau 980", referencia: "Al lado de la bodega",
      latitude: -13.5233, longitude: -71.9821, distancia_km: 4.2, zona: "Santiago",
      metodo_pago: "efectivo",
      cancel_reason: "cliente no recibió el pedido",
      items: [{ nombre: "Cuarto de pollo + papas", cantidad: 1, precio_unit: 19, notas: null }],
      delivery_fee: 7,
    }),
  ];
}
