const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const salesRoutes = require('./routes/salesRoutes');
const expensesRoutes = require('./routes/expensesRoutes');
const customersRoutes = require('./routes/customersRoutes');
const receivablesRoutes = require('./routes/receivablesRoutes');
const aiRoutes = require('./routes/aiRoutes');
const businessRoutes = require('./routes/businessRoutes');
const staffRoutes = require('./routes/staffRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de CORS segura y flexible
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (como Postman o curl) o si coincide con los permitidos
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('No permitido por la política de CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Límite de payload para proteger de ataques DoS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Montar Rutas de la Aplicación
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/receivables', receivablesRoutes);
app.use('/api/ai', aiRoutes);

// Ruta de comprobación de estado (Health Check)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🚀 Servidor de NegocioAI funcionando correctamente con PostgreSQL',
    timestamp: new Date().toISOString()
  });
});

// Manejo de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.method} ${req.url} no encontrada.` });
});

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
  console.error('🔴 Error interno en el servidor:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor. Por favor intenta más tarde.'
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
