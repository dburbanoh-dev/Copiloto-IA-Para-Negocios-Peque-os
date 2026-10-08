const aiService = require('../services/aiService');
const db = require('../config/db');

// 1. Interpretar mensaje del usuario
const parseMessage = async (req, res) => {
  const { message } = req.body;
  const { businessId } = req.user;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Por favor ingresa un mensaje para el copiloto.' });
  }

  try {
    const parsedResult = await aiService.parseUserMessage(message, businessId);
    res.json(parsedResult);
  } catch (error) {
    console.error('Error al procesar mensaje con IA:', error);
    res.status(500).json({ error: 'Error al interpretar la consulta.' });
  }
};

// 2. Ejecutar acción confirmada por el usuario
const executeAction = async (req, res) => {
  const { businessId } = req.user;
  const { intent, params } = req.body;

  if (!intent) {
    return res.status(400).json({ error: 'Intención no especificada.' });
  }

  try {
    switch (intent) {
      // A. CONSULTA: Ventas de Hoy
      case 'query_sales_today': {
        const result = await db.query(
          `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count 
           FROM sales
           WHERE business_id = $1 AND DATE(created_at) = CURRENT_DATE AND status != 'cancelled'`,
          [businessId]
        );
        const data = result.rows[0];
        return res.json({
          response: `📊 **Ventas de Hoy:** Has registrado ${data.count} venta(s) por un total de **$${Number(data.total).toLocaleString('es-CO')} COP**.`
        });
      }

      // B. CONSULTA: Gastos de Hoy
      case 'query_expenses_today': {
        const result = await db.query(
          `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count 
           FROM expenses WHERE business_id = $1 AND date = CURRENT_DATE`,
          [businessId]
        );
        const data = result.rows[0];
        return res.json({
          response: `💸 **Gastos de Hoy:** Has registrado ${data.count} gasto(s) por un total de **$${Number(data.total).toLocaleString('es-CO')} COP**.`
        });
      }

      // C. CONSULTA: Cuentas por Cobrar (Fiados)
      case 'query_receivables': {
        const result = await db.query(
          `SELECT COALESCE(SUM(total_amount - paid_amount), 0) as total_pending 
           FROM receivables WHERE business_id = $1 AND status != 'paid' AND status != 'cancelled'`,
          [businessId]
        );
        const data = result.rows[0];
        return res.json({
          response: `💰 **Cuentas por Cobrar:** Tienes un saldo pendiente total de **$${Number(data.total_pending).toLocaleString('es-CO')} COP** de clientes que te deben.`
        });
      }

      // D. CONSULTA: Stock Bajo
      case 'query_low_stock': {
        const result = await db.query(
          `SELECT name, stock, min_stock 
           FROM products 
           WHERE business_id = $1 AND is_service = false AND is_active = true AND stock <= min_stock`,
          [businessId]
        );
        if (result.rows.length === 0) {
          return res.json({ response: '🟢 **Inventario Saludable:** No tienes productos con stock bajo en este momento.' });
        }
        const listText = result.rows.map(p => `• ${p.name}: ${p.stock} unidades (Mínimo: ${p.min_stock})`).join('\n');
        return res.json({
          response: `🟡 **Productos con Stock Bajo (${result.rows.length}):**\n${listText}`
        });
      }

      // E. ACCIÓN: Registrar Venta
      case 'create_sale': {
        const { product_id, product_name, quantity, unit_price } = params;

        let finalProductId = product_id;

        // Si el producto no existía por ID, buscarlo o crearlo rápido
        if (!finalProductId) {
          const prodCheck = await db.query(
            'SELECT id FROM products WHERE business_id = $1 AND name ILIKE $2 LIMIT 1',
            [businessId, product_name]
          );
          if (prodCheck.rows.length > 0) {
            finalProductId = prodCheck.rows[0].id;
          } else {
            // Crear producto genérico rápido
            const newProd = await db.query(
              `INSERT INTO products (business_id, name, price, stock) VALUES ($1, $2, $3, 100) RETURNING id`,
              [businessId, product_name || 'Producto Varios', unit_price || 0]
            );
            finalProductId = newProd.rows[0].id;
          }
        }

        const totalAmt = quantity * unit_price;

        const saleRes = await db.query(
          `INSERT INTO sales (business_id, total_amount, payment_method, notes) VALUES ($1, $2, 'cash', 'Registrado vía Copiloto IA') RETURNING id`,
          [businessId, totalAmt]
        );

        await db.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES ($1, $2, $3, $4, $5)`,
          [saleRes.rows[0].id, finalProductId, quantity, unit_price, totalAmt]
        );

        return res.json({
          response: `✅ **¡Venta Registrada!**\nSe registró la venta de ${quantity} x ${product_name} por un total de **$${totalAmt.toLocaleString('es-CO')} COP**.`
        });
      }

      // F. ACCIÓN: Registrar Gasto
      case 'create_expense': {
        const { description, category, amount } = params;
        await db.query(
          `INSERT INTO expenses (business_id, description, category, amount) VALUES ($1, $2, $3, $4)`,
          [businessId, description || 'Gasto registrado por IA', category || 'otros', amount]
        );
        return res.json({
          response: `✅ **¡Gasto Registrado!**\nSe guardó el gasto de **$${Number(amount).toLocaleString('es-CO')} COP** en la categoría '${category}'.`
        });
      }

      // G. ACCIÓN: Registrar Fiado / Deuda
      case 'create_receivable': {
        const { customer_name, amount } = params;

        // Buscar o crear cliente
        let customerRes = await db.query(
          'SELECT id FROM customers WHERE business_id = $1 AND name ILIKE $2 LIMIT 1',
          [businessId, customer_name]
        );

        let customerId;
        if (customerRes.rows.length === 0) {
          const newCust = await db.query(
            'INSERT INTO customers (business_id, name) VALUES ($1, $2) RETURNING id',
            [businessId, customer_name]
          );
          customerId = newCust.rows[0].id;
        } else {
          customerId = customerRes.rows[0].id;
        }

        await db.query(
          `INSERT INTO receivables (business_id, customer_id, total_amount, paid_amount, status) VALUES ($1, $2, $3, 0, 'pending')`,
          [businessId, customerId, amount]
        );

        return res.json({
          response: `✅ **¡Deuda Registrada!**\nSe registró un fiado para **${customer_name}** por **$${Number(amount).toLocaleString('es-CO')} COP**.`
        });
      }

      default:
        return res.json({ response: 'No pude completar la acción requerida.' });
    }
  } catch (error) {
    console.error('Error al ejecutar acción de IA:', error);
    res.status(500).json({ error: 'Error al ejecutar la acción en el servidor.' });
  }
};

module.exports = {
  parseMessage,
  executeAction
};
