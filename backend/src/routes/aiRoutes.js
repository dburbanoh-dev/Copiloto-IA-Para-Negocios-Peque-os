const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/parse', aiController.parseMessage);
router.post('/execute', aiController.executeAction);

module.exports = router;
