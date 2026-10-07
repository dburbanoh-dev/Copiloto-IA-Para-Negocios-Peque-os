const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const salesRoutes = require('./routes/salesRoutes');
const expensesRoutes = require('./routes/expensesRoutes');
const customersRoutes = require('./routes/customersRoutes');
const receivablesRoutes = require('./routes/receivablesRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares globales
app.use(cors());
app.use(express.json());

// Montar Rutas de la Aplicación
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/receivables', receivablesRoutes);
app.use('/api/ai', aiRoutes);

// Ruta de comprobación de estado (Health Check)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🚀 Servidor de NegocioAI funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Inicio del servidor
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🟢 Servidor NegocioAI ejecutándose en el puerto ${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🤖 Copiloto IA: http://localhost:${PORT}/api/ai/parse`);
  console.log(`=================================`);
});
