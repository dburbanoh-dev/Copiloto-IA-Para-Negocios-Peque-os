const db = require('../config/db');

// 1. Obtener lista de citas / agenda del negocio
const getAppointments = async (req, res) => {
  const { businessId } = req.user;
  const { date, status, staff_id } = req.query;

  try {
    let queryText = `
      SELECT a.*, 
             s.name as staff_name, s.role as staff_role,
             p.name as service_name, p.duration_minutes
      FROM appointments a
      LEFT JOIN staff s ON a.staff_id = s.id
      LEFT JOIN products p ON a.service_id = p.id
      WHERE a.business_id = $1
    `;
    const queryParams = [businessId];

    if (date) {
      queryParams.push(date);
      queryText += ` AND DATE(a.scheduled_at) = $${queryParams.length}`;
    }

    if (status) {
      queryParams.push(status);
      queryText += ` AND a.status = $${queryParams.length}`;
    }

    if (staff_id) {
      queryParams.push(staff_id);
      queryText += ` AND a.staff_id = $${queryParams.length}`;
    }

    queryText += ' ORDER BY a.scheduled_at ASC';

    const result = await db.query(queryText, queryParams);

    // Resumen de citas del día
    const summaryRes = await db.query(
      `SELECT 
        COUNT(*) as total_today,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_today,
        COUNT(*) FILTER (WHERE status = 'scheduled') as pending_today,
        COALESCE(SUM(total_price) FILTER (WHERE status = 'completed'), 0) as income_today,
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'completed'), 0) as commissions_today
       FROM appointments
       WHERE business_id = $1 AND DATE(scheduled_at) = CURRENT_DATE`,
      [businessId]
    );

    res.json({
      summary: summaryRes.rows[0],
      appointments: result.rows
    });
  } catch (error) {
    console.error('Error al obtener citas:', error);
    res.status(500).json({ error: 'Error al consultar la agenda de citas.' });
  }
};

// 2. Crear nueva cita en la agenda
const createAppointment = async (req, res) => {
  const { businessId } = req.user;
  const {
    customer_name,
    customer_phone,
    staff_id,
    service_id,
    scheduled_at,
    notes
  } = req.body;

  if (!customer_name || !scheduled_at) {
    return res.status(400).json({ error: 'El nombre del cliente y la fecha/hora son obligatorios.' });
  }

  try {
    // 🔒 Verificar que el staff (si se asignó) pertenece a este negocio
    let commissionPct = 40.00;
    if (staff_id) {
      const staffRes = await db.query(
        'SELECT id, commission_pct FROM staff WHERE id = $1 AND business_id = $2',
        [staff_id, businessId]
      );
      if (staffRes.rows.length === 0) {
        return res.status(400).json({ error: 'El especialista seleccionado no pertenece a este negocio.' });
      }
      commissionPct = Number(staffRes.rows[0].commission_pct || 40.00);
    }

    // 🔒 Verificar que el servicio (si se asignó) pertenece a este negocio
    let servicePrice = 0;
    if (service_id) {
      const srvRes = await db.query(
        'SELECT id, price FROM products WHERE id = $1 AND business_id = $2',
        [service_id, businessId]
      );
      if (srvRes.rows.length === 0) {
        return res.status(400).json({ error: 'El servicio seleccionado no pertenece a este negocio.' });
      }
      servicePrice = Number(srvRes.rows[0].price || 0);
    }

    const commissionAmount = Math.round((servicePrice * commissionPct) / 100);

    const result = await db.query(
      `INSERT INTO appointments 
        (business_id, customer_name, customer_phone, staff_id, service_id, scheduled_at, status, total_price, commission_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9)
       RETURNING *`,
      [
        businessId,
        customer_name.trim(),
        customer_phone || null,
        staff_id || null,
        service_id || null,
        new Date(scheduled_at),
        servicePrice,
        commissionAmount,
        notes || null
      ]
    );

    res.status(201).json({
      message: '¡Cita agendada exitosamente!',
      appointment: result.rows[0]
    });
  } catch (error) {
    console.error('Error al agendar cita:', error);
    res.status(500).json({ error: 'Error al registrar la cita.' });
  }
};

// 3. Actualizar estado de cita (scheduled -> in_progress -> completed -> cancelled)
const updateAppointmentStatus = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado de cita no válido.' });
  }

  try {
    const updateRes = await db.query(
      `UPDATE appointments 
       SET status = $1 
       WHERE id = $2 AND business_id = $3 
       RETURNING *`,
      [status, id, businessId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    const appt = updateRes.rows[0];

    // Si se completó la cita y tenía un precio > 0, registrar venta automática en caja
    if (status === 'completed' && Number(appt.total_price) > 0) {
      const saleRes = await db.query(
        `INSERT INTO sales (business_id, total_amount, payment_method, notes)
         VALUES ($1, $2, 'cash', $3) RETURNING id`,
        [businessId, appt.total_price, `Servicio de cita #${appt.id.slice(0, 8)} - ${appt.customer_name}`]
      );

      if (appt.service_id) {
        await db.query(
          `INSERT INTO sale_items (sale_id, product_id, staff_id, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, 1, $4, $4)`,
          [saleRes.rows[0].id, appt.service_id, appt.staff_id, appt.total_price]
        );
      }
    }

    res.json({
      message: `Cita marcada como ${status === 'completed' ? 'completada y cobrada' : status}.`,
      appointment: appt
    });
  } catch (error) {
    console.error('Error al actualizar cita:', error);
    res.status(500).json({ error: 'Error al actualizar estado de la cita.' });
  }
};

// 4. Eliminar cita
const deleteAppointment = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM appointments WHERE id = $1 AND business_id = $2 RETURNING id',
      [id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    res.json({ message: 'Cita eliminada de la agenda correctamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la cita.' });
  }
};

module.exports = {
  getAppointments,
  createAppointment,
  updateAppointmentStatus,
  deleteAppointment
};
