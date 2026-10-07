const db = require('../config/db');

/**
 * Servicio de Inteligencia Artificial para parsing conversacional.
 * Convierte mensajes en español neutro / colombiano a una Intención Estructurada (JSON).
 */
const parseUserMessage = async (userMessage, businessId) => {
  const text = userMessage.toLowerCase().trim();

  // 1. Obtener catálogo del negocio para cruzar nombres de productos reales
  let catalog = [];
  try {
    const catRes = await db.query(
      'SELECT id, name, price, stock, is_service FROM products WHERE business_id = $1 AND is_active = true',
      [businessId]
    );
    catalog = catRes.rows;
  } catch (err) {
    console.error('Error al cargar catálogo para la IA:', err);
  }

  // --- REGLAS DE DETECCIÓN Y PARSING DE INTENCIONES ---

  // A. INTENCIÓN: Consultar Ventas de Hoy
  if (text.includes('cuanto vendi hoy') || text.includes('ventas de hoy') || text.includes('ventas hoy')) {
    return {
      intent: 'query_sales_today',
      requires_confirmation: false,
      summary: 'Consultar total de ventas registradas el día de hoy',
      params: {}
    };
  }

  // B. INTENCIÓN: Consultar Gastos de Hoy / Semana
  if (text.includes('cuanto gaste') || text.includes('gastos de hoy') || text.includes('gastos hoy')) {
    return {
      intent: 'query_expenses_today',
      requires_confirmation: false,
      summary: 'Consultar total de gastos registrados el día de hoy',
      params: {}
    };
  }

  // C. INTENCIÓN: Consultar Cuentas por Cobrar (Fiados)
  if (text.includes('cuanto me deben') || text.includes('quien me debe') || text.includes('deudas') || text.includes('fiados')) {
    return {
      intent: 'query_receivables',
      requires_confirmation: false,
      summary: 'Consultar lista de clientes con saldos pendientes',
      params: {}
    };
  }

  // D. INTENCIÓN: Consultar Inventario Bajo
  if (text.includes('poco inventario') || text.includes('stock bajo') || text.includes('que tengo que comprar') || text.includes('sin stock')) {
    return {
      intent: 'query_low_stock',
      requires_confirmation: false,
      summary: 'Consultar productos agotados o con nivel bajo de inventario',
      params: {}
    };
  }

  // E. INTENCIÓN: Registrar Venta (Ej. "Vendi 5 cervezas a 6000" o "Vendí 2 cortes a 20000")
  if (text.includes('vendi') || text.includes('venta') || text.includes('cobre')) {
    // Intentar extraer números (cantidad y precio)
    const numbers = text.match(/\d+(\.\d+)?/g);
    
    let quantity = 1;
    let unit_price = null;

    if (numbers && numbers.length >= 2) {
      quantity = parseFloat(numbers[0]);
      unit_price = parseFloat(numbers[1]);
    } else if (numbers && numbers.length === 1) {
      unit_price = parseFloat(numbers[0]);
    }

    // Buscar coincidencia en el catálogo
    let matchedProduct = null;
    for (const prod of catalog) {
      if (text.includes(prod.name.toLowerCase())) {
        matchedProduct = prod;
        break;
      }
    }

    // Si no especificó precio explícito pero encontró producto, usar el del catálogo
    if (!unit_price && matchedProduct) {
      unit_price = Number(matchedProduct.price);
    }

    const priceVal = unit_price || 0;
    const totalCalc = quantity * priceVal;

    return {
      intent: 'create_sale',
      requires_confirmation: true,
      summary: `Registrar venta: ${quantity} x ${matchedProduct ? matchedProduct.name : 'producto'} @ $${priceVal.toLocaleString('es-CO')}`,
      params: {
        product_id: matchedProduct ? matchedProduct.id : null,
        product_name: matchedProduct ? matchedProduct.name : 'Producto detectado',
        quantity,
        unit_price: priceVal,
        total_amount: totalCalc
      }
    };
  }

  // F. INTENCIÓN: Registrar Gasto (Ej. "Gaste 50000 en mercancia" o "Compre 20 cuadernos por 40000")
  if (text.includes('gaste') || text.includes('compre') || text.includes('pague')) {
    const numbers = text.match(/\d+(\.\d+)?/g);
    const amount = numbers && numbers.length > 0 ? parseFloat(numbers[numbers.length - 1]) : 0;

    let category = 'otros';
    if (text.includes('mercancia') || text.includes('inventario') || text.includes('proveedor')) category = 'inventario';
    if (text.includes('arriendo') || text.includes('alquiler')) category = 'arriendo';
    if (text.includes('luz') || text.includes('agua') || text.includes('servicio')) category = 'servicios';
    if (text.includes('transporte') || text.includes('flete')) category = 'transporte';

    return {
      intent: 'create_expense',
      requires_confirmation: true,
      summary: `Registrar gasto de $${amount.toLocaleString('es-CO')} en categoría '${category}'`,
      params: {
        description: userMessage,
        category,
        amount
      }
    };
  }

  // G. INTENCIÓN: Registrar Fiado / Deuda (Ej. "Carlos quedo debiendo 35000")
  if (text.includes('debiendo') || text.includes('fiado') || text.includes('debe')) {
    const numbers = text.match(/\d+(\.\d+)?/g);
    const amount = numbers && numbers.length > 0 ? parseFloat(numbers[0]) : 0;

    // Extraer posible nombre del cliente (palabras antes de 'quedo' o 'debe')
    const words = userMessage.split(' ');
    const customerName = words[0] !== 'quedo' && words[0] !== 'debe' ? words[0] : 'Cliente';

    return {
      intent: 'create_receivable',
      requires_confirmation: true,
      summary: `Registrar deuda para '${customerName}' por valor de $${amount.toLocaleString('es-CO')}`,
      params: {
        customer_name: customerName,
        amount
      }
    };
  }

  // H. INTENCIÓN NO DETECTADA / RESPUESTA GENERATIVA GENERICA
  return {
    intent: 'unknown',
    requires_confirmation: false,
    summary: 'No se pudo detectar una acción específica. Puedes registrar ventas, gastos, fiados o hacer preguntas.',
    params: {
      userMessage
    }
  };
};

module.exports = {
  parseUserMessage
};
