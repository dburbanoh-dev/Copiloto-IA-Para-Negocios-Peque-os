const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const authMiddleware = require('../middleware/authMiddleware');

// Ruta pública para listar tipos de negocio en el registro
router.get('/types', businessController.getBusinessTypes);

// Rutas protegidas para el negocio autenticado
router.use(authMiddleware);
router.get('/config', businessController.getBusinessConfig);
router.put('/config', businessController.updateBusinessConfig);

module.exports = router;
