const express = require('express');
const router = express.Router();
const expensesController = require('../controllers/expensesController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', expensesController.getExpenses);
router.post('/', expensesController.createExpense);
router.delete('/:id', expensesController.deleteExpense);

module.exports = router;
