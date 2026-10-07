const db = require('../config/db');

// 1. Obtener lista de gastos
const getExpenses = async (req, res) => {
  const { businessId } = req.user;
  const { category, start_date, end_date } = req.query;

  try {
    let queryText = 'SELECT * FROM expenses WHERE business_id = $1';
    const queryParams = [businessId];

    if (category) {
      queryParams.push(category);
      queryText += ` AND category = $${queryParams.length}`;
    }

    if (start_date) {
      queryParams.push(start_date);
      queryText += ` AND date >= $${queryParams.length}`;
    }

    if (end_date) {
      queryParams.push(end_date);
      queryText += ` AND date <= $${queryParams.length}`;
    }

    queryText += ' ORDER BY date DESC, created_at DESC';

    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener gastos:', error);
    res.status(500).json({ error: 'Error al consultar lista de gastos.' });
  }
};

// 2. Registrar un nuevo gasto
const createExpense = async (req, res) => {
  const { businessId } = req.user;
  const { description, category, amount, payment_method, date } = req.body;

  if (!description || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'La descripción y un monto mayor a cero son obligatorios.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO expenses (business_id, description, category, amount, payment_method, date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        businessId,
        description.trim(),
        category || 'otros',
        Number(amount),
        payment_method || 'cash',
        date || new Date().toISOString().split('T')[0]
      ]
    );

    res.status(201).json({
      message: 'Gasto registrado exitosamente.',
      expense: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear gasto:', error);
    res.status(500).json({ error: 'Error al registrar el gasto.' });
  }
};

// 3. Eliminar un gasto
const deleteExpense = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM expenses WHERE id = $1 AND business_id = $2 RETURNING id',
      [id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado.' });
    }

    res.json({ message: 'Gasto eliminado exitosamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el gasto.' });
  }
};

module.exports = {
  getExpenses,
  createExpense,
  deleteExpense
};
