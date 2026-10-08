const db = require('../config/db');

// 1. Registrar una nueva Venta
const createSale = async (req, res) => {
  const { businessId } = req.user;
  const { customer_id, payment_method, notes, items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La venta debe contener al menos un producto o servicio.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 🔒 Verificación Multi-Tenant: Si se asigna cliente, verificar que pertenece a este negocio
    if (customer_id) {
      const custCheck = await client.query(
        'SELECT id FROM customers WHERE id = $1 AND business_id = $2',
        [customer_id, businessId]
      );
      if (custCheck.rows.length === 0) {
        throw new Error('Aislamiento de seguridad: El cliente seleccionado no pertenece a tu negocio.');
      }
    }

    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const { product_id, quantity, unit_price } = item;

      if (!product_id || !quantity || quantity <= 0) {
        throw new Error('Cada ítem de venta debe tener un producto válido y cantidad mayor a cero.');
      }

      const prodRes = await client.query(
        'SELECT id, name, price, stock, is_service, is_active FROM products WHERE id = $1 AND business_id = $2',
        [product_id, businessId]
      );

      if (prodRes.rows.length === 0) {
        throw new Error(`El producto con ID "${product_id}" no existe en tu catálogo.`);
      }

      const product = prodRes.rows[0];

      if (!product.is_active) {
        throw new Error(`El producto "${product.name}" se encuentra inactivo.`);
      }

      const itemPrice = unit_price !== undefined ? Number(unit_price) : Number(product.price);
      const subtotal = Number(quantity) * itemPrice;
      calculatedTotal += subtotal;

      validatedItems.push({
        product,
        quantity: Number(quantity),
        unit_price: itemPrice,
        subtotal
      });
    }

    const saleResult = await client.query(
      `INSERT INTO sales (business_id, customer_id, total_amount, payment_method, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        businessId,
        customer_id || null,
        calculatedTotal,
        payment_method || 'cash',
        notes || null
      ]
    );

    const newSale = saleResult.rows[0];

    for (const item of validatedItems) {
      const { product, quantity, unit_price, subtotal } = item;

      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [newSale.id, product.id, quantity, unit_price, subtotal]
      );

      if (!product.is_service) {
        const previousStock = Number(product.stock);
        const newStock = previousStock - quantity;

        await client.query(
          'UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2',
          [newStock, product.id]
        );

        await client.query(
          `INSERT INTO inventory_movements 
            (business_id, product_id, type, quantity, previous_stock, new_stock, reason)
           VALUES ($1, $2, 'sale', $3, $4, $5, $6)`,
          [businessId, product.id, -quantity, previousStock, newStock, `Venta #${newSale.id.slice(0, 8)}`]
        );
      }
    }

    if (payment_method === 'credit') {
      if (!customer_id) {
        throw new Error('Para registrar una venta a crédito/fiado debes asociar un cliente.');
      }

      await client.query(
        `INSERT INTO receivables (business_id, customer_id, sale_id, total_amount, paid_amount, status)
         VALUES ($1, $2, $3, $4, 0, 'pending')`,
        [businessId, customer_id, newSale.id, calculatedTotal]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: '¡Venta registrada exitosamente!',
      sale: newSale,
      items: validatedItems
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar venta:', error.message);
    res.status(400).json({ error: error.message || 'Error al procesar la venta.' });
  } finally {
    client.release();
  }
};

// 2. Obtener lista de Ventas del Negocio con resumen de ítems vendidos
const getSales = async (req, res) => {
  const { businessId } = req.user;
  const { start_date, end_date, payment_method, limit = 50 } = req.query;

  try {
    let queryText = `
      SELECT s.*, c.name as customer_name,
        COALESCE(
          (SELECT string_agg(CONCAT(si.quantity, 'x ', p.name), ', ')
           FROM sale_items si
           JOIN products p ON si.product_id = p.id
           WHERE si.sale_id = s.id), 'Venta General'
        ) as items_summary
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.business_id = $1
    `;
    const queryParams = [businessId];

    if (payment_method) {
      queryParams.push(payment_method);
      queryText += ` AND s.payment_method = $${queryParams.length}`;
    }

    if (start_date) {
      queryParams.push(start_date);
      queryText += ` AND s.created_at >= $${queryParams.length}`;
    }

    if (end_date) {
      queryParams.push(end_date);
      queryText += ` AND s.created_at <= $${queryParams.length}`;
    }

    queryText += ` ORDER BY s.created_at DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(Number(limit));

    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    res.status(500).json({ error: 'Error al consultar historial de ventas.' });
  }
};

// 3. Obtener detalle de una Venta específica
const getSaleById = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;

  try {
    const saleRes = await db.query(
      `SELECT s.*, c.name as customer_name, c.phone as customer_phone
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.id = $1 AND s.business_id = $2`,
      [id, businessId]
    );

    if (saleRes.rows.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada.' });
    }

    const itemsRes = await db.query(
      `SELECT si.*, p.name as product_name, p.is_service
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = $1`,
      [id]
    );

    res.json({
      sale: saleRes.rows[0],
      items: itemsRes.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener detalle de la venta.' });
  }
};

// 4. Anular una venta (Revertir inventario)
const cancelSale = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const saleRes = await client.query(
      'SELECT * FROM sales WHERE id = $1 AND business_id = $2 FOR UPDATE',
      [id, businessId]
    );

    if (saleRes.rows.length === 0) {
      throw new Error('Venta no encontrada.');
    }

    const sale = saleRes.rows[0];

    if (sale.status === 'cancelled') {
      throw new Error('La venta ya se encuentra anulada.');
    }

    const itemsRes = await client.query(
      'SELECT si.*, p.is_service, p.stock FROM sale_items si JOIN products p ON si.product_id = p.id WHERE si.sale_id = $1',
      [id]
    );

    for (const item of itemsRes.rows) {
      if (!item.is_service) {
        const previousStock = Number(item.stock);
        const newStock = previousStock + Number(item.quantity);

        await client.query('UPDATE products SET stock = $1 WHERE id = $2', [newStock, item.product_id]);

        await client.query(
          `INSERT INTO inventory_movements 
            (business_id, product_id, type, quantity, previous_stock, new_stock, reason)
           VALUES ($1, $2, 'adjustment', $3, $4, $5, $6)`,
          [businessId, item.product_id, item.quantity, previousStock, newStock, `Anulación de Venta #${id.slice(0, 8)}`]
        );
      }
    }

    await client.query("UPDATE sales SET status = 'cancelled' WHERE id = $1", [id]);

    await client.query("UPDATE receivables SET status = 'cancelled' WHERE sale_id = $1", [id]);

    await client.query('COMMIT');

    res.json({ message: 'Venta anulada e inventario reestablecido correctamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message || 'Error al anular la venta.' });
  } finally {
    client.release();
  }
};

module.exports = {
  createSale,
  getSales,
  getSaleById,
  cancelSale
};
