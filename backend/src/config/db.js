const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config(); // Fallback if CWD has .env

// Conexión ÚNICA a PostgreSQL — Sin fallback a JSON
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Pool optimizado para desarrollo
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Verificar conexión al iniciar y crear tablas si no existen
const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conectado exitosamente a PostgreSQL.');

    // Ejecutar schema.sql para crear tablas si no existen
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await client.query(schema);
      console.log('✅ Schema de base de datos verificado/creado correctamente.');
    }

    client.release();
  } catch (err) {
    console.error('🔴 ERROR CRÍTICO: No se pudo conectar a PostgreSQL.');
    console.error('   Asegúrate de que PostgreSQL está ejecutándose y que DATABASE_URL es correcto.');
    console.error(`   DATABASE_URL actual: ${process.env.DATABASE_URL}`);
    console.error('   Detalle del error:', err.message);
    // No cerramos el proceso para permitir reconexión automática del pool
  }
};

// Ejecutar inicialización
initializeDatabase();

// Manejar errores inesperados del pool
pool.on('error', (err) => {
  console.error('🔴 Error inesperado en el pool de PostgreSQL:', err.message);
});

module.exports = {
  // Para queries simples sin transacción
  query: (text, params) => pool.query(text, params),

  // Para transacciones que necesitan un client dedicado
  pool,

  // Utilidad para cerrar conexiones limpiamente
  close: () => pool.end()
};
