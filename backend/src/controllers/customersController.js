const db = require('../config/db');

// 1. Obtener lista de clientes con su saldo pendiente (fiado total)
const getCustomers = async (req, res) => {
  const { businessId } = req.user;
  const { search } = req.query;

  try {
    let queryText = `
      SELECT c.*, 
        COALESCE(SUM(r.total_amount - r.paid_amount) FILTER (WHERE r.status != 'paid' AND r.status != 'cancelled'), 0) as pending_debt
      FROM customers c
      LEFT JOIN receivables r ON c.id = r.customer_id
      WHERE c.business_id = $1
    `;
    const queryParams = [businessId];

    if (search) {
      queryParams.push(`%${search}%`);
      queryText += ` AND (c.name ILIKE $${queryParams.length} OR c.phone ILIKE $${queryParams.length})`;
    }

    queryText += ' GROUP BY c.id ORDER BY c.name ASC';

    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al consultar lista de clientes.' });
  }
};

// 2. Obtener detalle de un cliente (Historial de compras y deudas)
const getCustomerById = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;

  try {
    const customerRes = await db.query(
      'SELECT * FROM customers WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (customerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    // Obtener deudas activas o pendientes filtrando estrictamente por este negocio
    const debtsRes = await db.query(
      `SELECT * FROM receivables WHERE customer_id = $1 AND business_id = $2 AND status != 'cancelled' ORDER BY created_at DESC`,
      [id, businessId]
    );

    // Obtener últimas 10 ventas del cliente filtrando estrictamente por este negocio
    const salesRes = await db.query(
      `SELECT * FROM sales WHERE customer_id = $1 AND business_id = $2 ORDER BY created_at DESC LIMIT 10`,
      [id, businessId]
    );

    res.json({
      customer: customerRes.rows[0],
      receivables: debtsRes.rows,
      sales: salesRes.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar detalle del cliente.' });
  }
};

// 3. Crear cliente
const createCustomer = async (req, res) => {
  const { businessId } = req.user;
  const { name, phone, notes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO customers (business_id, name, phone, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [businessId, name.trim(), phone || null, notes || null]
    );

    res.status(201).json({
      message: 'Cliente registrado exitosamente.',
      customer: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({ error: 'Error al registrar el cliente.' });
  }
};

// 4. Actualizar cliente
const updateCustomer = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;
  const { name, phone, notes } = req.body;

  try {
    const result = await db.query(
      `UPDATE customers 
       SET name = COALESCE($1, name),
           phone = $2,
           notes = $3
       WHERE id = $4 AND business_id = $5
       RETURNING *`,
      [name ? name.trim() : null, phone || null, notes || null, id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    res.json({
      message: 'Cliente actualizado exitosamente.',
      customer: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el cliente.' });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer
};
