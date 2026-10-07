const db = require('../config/db');

// 1. Obtener lista de Cuentas por Cobrar (Fiados)
const getReceivables = async (req, res) => {
  const { businessId } = req.user;
  const { status, customer_id } = req.query;

  try {
    let queryText = `
      SELECT r.*, c.name as customer_name, c.phone as customer_phone
      FROM receivables r
      JOIN customers c ON r.customer_id = c.id
      WHERE r.business_id = $1 AND r.status != 'cancelled'
    `;
    const queryParams = [businessId];

    if (status) {
      queryParams.push(status);
      queryText += ` AND r.status = $${queryParams.length}`;
    }

    if (customer_id) {
      queryParams.push(customer_id);
      queryText += ` AND r.customer_id = $${queryParams.length}`;
    }

    queryText += ' ORDER BY r.created_at DESC';

    const result = await db.query(queryText, queryParams);

    const summaryRes = await db.query(
      `SELECT 
        COALESCE(SUM(total_amount - paid_amount), 0) as total_pending_amount,
        COUNT(*) FILTER (WHERE status != 'paid') as pending_count
       FROM receivables 
       WHERE business_id = $1 AND status != 'cancelled'`,
      [businessId]
    );

    res.json({
      summary: summaryRes.rows[0],
      receivables: result.rows
    });
  } catch (error) {
    console.error('Error al obtener cuentas por cobrar:', error);
    res.status(500).json({ error: 'Error al consultar fiados y cuentas por cobrar.' });
  }
};

// 2. Registrar una Nueva Cuenta por Cobrar / Fiado Directo
const createReceivable = async (req, res) => {
  const { businessId } = req.user;
  const { customer_name, phone, concept, amount, due_date, notes } = req.body;

  if (!customer_name || !customer_name.trim() || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'El nombre del cliente y un valor mayor a cero son obligatorios.' });
  }

  try {
    let customerRes = await db.query(
      'SELECT id FROM customers WHERE business_id = $1 AND name ILIKE $2 LIMIT 1',
      [businessId, customer_name.trim()]
    );

    let customerId;
    if (customerRes.rows.length === 0) {
      const newCust = await db.query(
        'INSERT INTO customers (business_id, name, phone, notes) VALUES ($1, $2, $3, $4) RETURNING id',
        [businessId, customer_name.trim(), phone || null, concept || null]
      );
      customerId = newCust.rows[0].id;
    } else {
      customerId = customerRes.rows[0].id;
    }

    const result = await db.query(
      `INSERT INTO receivables (business_id, customer_id, total_amount, paid_amount, status, due_date, concept, notes)
       VALUES ($1, $2, $3, 0, 'pending', $4, $5, $6)
       RETURNING *`,
      [
        businessId,
        customerId,
        Number(amount),
        due_date || null,
        concept || 'Fiado registrado en tienda',
        notes || null
      ]
    );

    res.status(201).json({
      message: '¡Fiado registrado exitosamente!',
      receivable: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear fiado:', error);
    res.status(500).json({ error: 'Error al registrar el fiado.' });
  }
};

// 3. Registrar un Abono o Pago de Deuda
const recordPayment = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Ingresa un valor de abono mayor a cero.' });
  }

  try {
    const debtRes = await db.query(
      'SELECT * FROM receivables WHERE id = $1 AND business_id = $2',
      [id, businessId]
    );

    if (debtRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta por cobrar no encontrada.' });
    }

    const debt = debtRes.rows[0];

    if (debt.status === 'paid') {
      return res.status(400).json({ error: 'Esta deuda ya se encuentra completamente pagada.' });
    }

    const currentPaid = Number(debt.paid_amount);
    const totalAmount = Number(debt.total_amount);
    const paymentVal = Number(amount);
    const newPaidAmount = currentPaid + paymentVal;
    const remainingDebt = Math.max(0, totalAmount - newPaidAmount);

    let newStatus = 'partial';
    if (newPaidAmount >= totalAmount) {
      newStatus = 'paid';
    }

    const updateRes = await db.query(
      `UPDATE receivables 
       SET paid_amount = $1, status = $2 
       WHERE id = $3 AND business_id = $4
       RETURNING *`,
      [newPaidAmount, newStatus, id, businessId]
    );

    const updatedRec = updateRes.rows[0] || { ...debt, paid_amount: newPaidAmount, status: newStatus };

    res.json({
      message: newStatus === 'paid'
        ? '🎉 ¡Deuda cancelada en su totalidad!'
        : `✅ ¡Abono de $${paymentVal.toLocaleString('es-CO')} COP registrado! Saldo restante adeudado: $${remainingDebt.toLocaleString('es-CO')} COP.`,
      receivable: updatedRec
    });
  } catch (error) {
    console.error('Error al registrar abono:', error);
    res.status(500).json({ error: 'Error al procesar el abono.' });
  }
};

// 4. Eliminar por completo un registro de fiado pagado o saldado
const deleteReceivable = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM receivables WHERE id = $1 AND business_id = $2 RETURNING id',
      [id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fiado no encontrado.' });
    }

    res.json({ message: 'Registro de fiado eliminado por completo de la lista.' });
  } catch (error) {
    console.error('Error al eliminar fiado:', error);
    res.status(500).json({ error: 'Error al eliminar el registro.' });
  }
};

module.exports = {
  getReceivables,
  createReceivable,
  recordPayment,
  deleteReceivable
};
