const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');

// Proteger todas las rutas de productos con el token de autenticación
router.use(authMiddleware);

// Rutas de Categorías
router.get('/categories', productController.getCategories);
router.post('/categories', productController.createCategory);

// Rutas de Productos y Servicios
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.patch('/:id/toggle', productController.toggleProductStatus);

module.exports = router;
