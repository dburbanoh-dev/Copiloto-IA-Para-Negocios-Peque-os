const express = require('express');
const router = express.Router();
const receivablesController = require('../controllers/receivablesController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', receivablesController.getReceivables);
router.post('/', receivablesController.createReceivable);
router.post('/:id/pay', receivablesController.recordPayment);
router.delete('/:id', receivablesController.deleteReceivable);

module.exports = router;
