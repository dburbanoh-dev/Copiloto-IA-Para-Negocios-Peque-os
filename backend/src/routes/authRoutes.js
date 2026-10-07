const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../config/db');

// Ruta 1: Registro de usuario y negocio
router.post('/register', authController.register);

// Ruta 2: Inicio de sesión
router.post('/login', authController.login);

// Ruta 3: Obtener perfil del usuario autenticado (Protegida)
router.get('/me', authMiddleware, authController.getProfile);

// Ruta 4: Obtener tipos de negocio disponibles
router.get('/business-types', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, description FROM business_types ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    // Si la BD aún no está inicializada con scripts, devolvemos el catálogo estático por defecto
    res.json([
      { id: 'tienda', name: 'Tienda de Barrio / Minimercado', description: 'Venta de abarrotes y productos de consumo diario' },
      { id: 'bar', name: 'Bar / Licorera', description: 'Venta de bebidas alcohólicas y snacks' },
      { id: 'papeleria', name: 'Papelería / Variedades', description: 'Útiles escolares, papelería e impresiones' },
      { id: 'barberia', name: 'Barbería / Peluquería', description: 'Servicios de cortes, barba y estética' },
      { id: 'restaurante', name: 'Restaurante / Comidas Rápidas', description: 'Venta de platos y bebidas preparados' },
      { id: 'emprendimiento', name: 'Emprendimiento / Tienda Virtual', description: 'Productos propios o catálogo general' },
      { id: 'otro', name: 'Otro Comercio Local', description: 'Otros tipos de negocios pequeños' }
    ]);
  }
});

module.exports = router;
