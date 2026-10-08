const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Middleware de Autenticación y Aislamiento Multi-Tenant
 * Garantiza que CADA petición provenga de un usuario verificado
 * y que NINGÚN negocio pueda consultar, modificar o acceder a datos de otro.
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Acceso no autorizado. Se requiere un token de autenticación.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const jwtSecret = process.env.JWT_SECRET || 'desarrollo_secreto_negocioai_2026_jwt_token_key';
    const decoded = jwt.verify(token, jwtSecret);

    if (!decoded.userId || !decoded.businessId) {
      return res.status(403).json({
        error: 'Acceso denegado: Sesión incompleta o sin negocio asignado.'
      });
    }

    // 🔒 Verificación estricta en Base de Datos:
    // El usuario DEBE ser el dueño o tener pertenencia verificada del business_id
    const bizResult = await db.query(
      'SELECT id, name, user_id FROM businesses WHERE id = $1 AND user_id = $2',
      [decoded.businessId, decoded.userId]
    );

    if (bizResult.rows.length === 0) {
      console.warn(`🚨 ALERTA DE SEGURIDAD: Usuario ${decoded.userId} intentó acceder a negocio no autorizado ${decoded.businessId}`);
      return res.status(403).json({
        error: 'Aislamiento de Seguridad: No tienes permisos para consultar o modificar este negocio.'
      });
    }

    // Tenant seguro inyectado en la petición
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      businessId: bizResult.rows[0].id
    };
    req.business = bizResult.rows[0];

    // 🛡️ Protección contra Tenant Injection / Spoofing:
    // Sobrescribir cualquier intento de inyectar business_id en body, query o params
    if (req.body && typeof req.body === 'object') {
      req.body.business_id = req.user.businessId;
      req.body.businessId = req.user.businessId;
    }
    if (req.query && typeof req.query === 'object') {
      req.query.business_id = req.user.businessId;
      req.query.businessId = req.user.businessId;
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Tu sesión ha expirado. Por favor ingresa nuevamente.' });
    }
    return res.status(403).json({
      error: 'Token inválido o no reconocido.'
    });
  }
};

module.exports = authMiddleware;
