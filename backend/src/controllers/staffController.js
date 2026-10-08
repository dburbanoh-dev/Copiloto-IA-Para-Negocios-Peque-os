const db = require('../config/db');

// 1. Obtener lista de personal / barberos del negocio
const getStaff = async (req, res) => {
  const { businessId } = req.user;

  try {
    const result = await db.query(
      `SELECT s.*, 
        COUNT(a.id) FILTER (WHERE a.status = 'completed') as completed_appointments,
        COALESCE(SUM(a.commission_amount) FILTER (WHERE a.status = 'completed'), 0) as total_commissions_earned
       FROM staff s
       LEFT JOIN appointments a ON s.id = a.staff_id
       WHERE s.business_id = $1
       GROUP BY s.id
       ORDER BY s.name ASC`,
      [businessId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener personal:', error);
    res.status(500).json({ error: 'Error al consultar equipo de trabajo.' });
  }
};

// 2. Registrar nuevo miembro del personal
const createStaff = async (req, res) => {
  const { businessId } = req.user;
  const { name, role, phone, commission_pct } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre del especialista o barbero es obligatorio.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO staff (business_id, name, role, phone, commission_pct)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        businessId,
        name.trim(),
        role || 'barbero',
        phone || null,
        commission_pct !== undefined ? Number(commission_pct) : 40.00
      ]
    );

    res.status(201).json({
      message: '¡Especialista registrado exitosamente!',
      staff: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear personal:', error);
    res.status(500).json({ error: 'Error al guardar miembro del equipo.' });
  }
};

// 3. Actualizar miembro del personal
const updateStaff = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;
  const { name, role, phone, commission_pct, is_active } = req.body;

  try {
    const result = await db.query(
      `UPDATE staff
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           phone = COALESCE($3, phone),
           commission_pct = COALESCE($4, commission_pct),
           is_active = COALESCE($5, is_active)
       WHERE id = $6 AND business_id = $7
       RETURNING *`,
      [
        name ? name.trim() : null,
        role || null,
        phone || null,
        commission_pct !== undefined ? Number(commission_pct) : null,
        is_active !== undefined ? Boolean(is_active) : null,
        id,
        businessId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Miembro del personal no encontrado.' });
    }

    res.json({
      message: 'Personal actualizado correctamente.',
      staff: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar personal.' });
  }
};

// 4. Eliminar miembro del personal
const deleteStaff = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM staff WHERE id = $1 AND business_id = $2 RETURNING id',
      [id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Personal no encontrado.' });
    }

    res.json({ message: 'Especialista eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar miembro del personal.' });
  }
};

module.exports = {
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff
};
