const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // Obtener el encabezado Authorization (Ej: "Bearer eyJhbGciOi...")
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Acceso no autorizado. Se requiere un token de autenticación.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verificar y decodificar el token usando el secreto
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'desarrollo_secreto');
    
    // Adjuntar la información del usuario autenticado a la petición (req)
    req.user = decoded; // Contendrá: { userId, email, businessId }
    
    next();
  } catch (error) {
    return res.status(403).json({
      error: 'Token inválido o expirado. Por favor inicia sesión nuevamente.'
    });
  }
};

module.exports = authMiddleware;
