const db = require('../config/db');

// Catálogo maestro de módulos disponibles en el sistema SaaS
const AVAILABLE_MODULES = [
  { id: 'pos', name: 'Punto de Venta (Ventas Rápidas)', icon: '🛒', description: 'Registro de ventas rápidas, cobro en efectivo/transferencia y ticket' },
  { id: 'inventory', name: 'Control de Inventario & Stock', icon: '📦', description: 'Existencias de productos físicos, stock mínimo, kardex y códigos de barra' },
  { id: 'services', name: 'Catálogo de Servicios', icon: '✂️', description: 'Cortes, estética, fotocopias, impresiones, con duración y precio' },
  { id: 'appointments', name: 'Agenda & Citas', icon: '📅', description: 'Calendario de citas por cliente, horario de atención y estado del servicio' },
  { id: 'staff', name: 'Personal & Comisiones', icon: '💈', description: 'Barberos, empleados, porcentaje de comisión e historial de trabajos' },
  { id: 'receivables', name: 'Fiados & Cuentas por Cobrar', icon: '💰', description: 'Registro de clientes que fían, abonos parciales y saldo restante' },
  { id: 'expenses', name: 'Gastos Operativos', icon: '💸', description: 'Registro de compras, servicios, nómina o gastos varios del local' },
  { id: 'reports', name: 'Reportes & Métricas', icon: '📊', description: 'Ganancias estimadas, historial de transacciones y resumen contable' },
  { id: 'tables', name: 'Mesas & Cuentas Abiertas', icon: '🍽️', description: 'Control de consumo por mesas para bares y restaurantes' },
  { id: 'copilot', name: 'Copiloto IA Empresarial', icon: '🤖', description: 'Asistente de inteligencia artificial por voz/texto para registrar y consultar' }
];

// 1. Obtener configuración actual del negocio
const getBusinessConfig = async (req, res) => {
  const { businessId } = req.user;

  try {
    const bizRes = await db.query(
      `SELECT b.id, b.name, b.business_type_id, b.phone, b.city, b.country, b.currency, 
              b.enabled_modules, b.settings, bt.name as type_name, bt.description as type_description
       FROM businesses b
       LEFT JOIN business_types bt ON b.business_type_id = bt.id
       WHERE b.id = $1`,
      [businessId]
    );

    if (bizRes.rows.length === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado.' });
    }

    res.json({
      business: bizRes.rows[0],
      available_modules: AVAILABLE_MODULES
    });
  } catch (error) {
    console.error('Error al obtener configuración de negocio:', error);
    res.status(500).json({ error: 'Error al consultar configuración del negocio.' });
  }
};

// 2. Actualizar configuración y módulos habilitados
const updateBusinessConfig = async (req, res) => {
  const { businessId } = req.user;
  const { name, phone, city, currency, enabled_modules, settings } = req.body;

  try {
    // Validar que enabled_modules sea un arreglo de módulos válidos si viene provisto
    let safeModules = null;
    if (enabled_modules && Array.isArray(enabled_modules)) {
      const validIds = new Set(AVAILABLE_MODULES.map(m => m.id));
      safeModules = enabled_modules.filter(m => validIds.has(m));
    }

    const updateRes = await db.query(
      `UPDATE businesses 
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           city = COALESCE($3, city),
           currency = COALESCE($4, currency),
           enabled_modules = COALESCE($5, enabled_modules),
           settings = COALESCE($6, settings),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, business_type_id, phone, city, currency, enabled_modules, settings`,
      [
        name ? name.trim() : null,
        phone || null,
        city || null,
        currency || null,
        safeModules,
        settings ? JSON.stringify(settings) : null,
        businessId
      ]
    );

    res.json({
      message: '¡Configuración del negocio actualizada exitosamente!',
      business: updateRes.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({ error: 'Error al actualizar configuración.' });
  }
};

// 3. Listar plantillas de tipos de negocio disponibles
const getBusinessTypes = async (req, res) => {
  try {
    const typesRes = await db.query('SELECT * FROM business_types ORDER BY name ASC');
    res.json(typesRes.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tipos de negocio.' });
  }
};

module.exports = {
  getBusinessConfig,
  updateBusinessConfig,
  getBusinessTypes,
  AVAILABLE_MODULES
};
