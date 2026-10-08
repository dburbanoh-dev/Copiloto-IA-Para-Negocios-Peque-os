const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Registro de Usuario y Creación de Negocio Inicial
const register = async (req, res) => {
  const { full_name, email, password, business_name, business_type_id, phone, city } = req.body;

  // 1. Validaciones básicas
  if (!full_name || !email || !password || !business_name || !business_type_id) {
    return res.status(400).json({
      error: 'Por favor completa todos los campos requeridos (nombre, email, contraseña, nombre del negocio y tipo de negocio).'
    });
  }

  try {
    // 2. Verificar si el email ya existe
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // 3. Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Iniciar transacción en la BD
    const userResult = await db.query(
      `INSERT INTO users (full_name, email, password_hash, phone) 
       VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, phone, created_at`,
      [full_name, email.toLowerCase().trim(), passwordHash, phone || null]
    );

    const newUser = userResult.rows[0];

    // 5. Crear el Negocio asociado al Usuario
    const businessResult = await db.query(
      `INSERT INTO businesses (user_id, business_type_id, name, city) 
       VALUES ($1, $2, $3, $4) RETURNING id, name, business_type_id, city, currency`,
      [newUser.id, business_type_id, business_name, city || 'Medellín']
    );

    const newBusiness = businessResult.rows[0];

    // 6. Cargar productos semilla por defecto (Aguardiente Nariño, Amarillo, Buchanas, Poker, Aguila, Coronita)
    const seedProducts = [
      { name: 'Aguardiente Nariño', price: 45000, cost: 32000, stock: 25, min_stock: 5 },
      { name: 'Aguardiente Amarillo', price: 55000, cost: 40000, stock: 20, min_stock: 5 },
      { name: "Whisky Buchanan's", price: 140000, cost: 105000, stock: 15, min_stock: 3 },
      { name: 'Cerveza Poker', price: 4500, cost: 3000, stock: 60, min_stock: 10 },
      { name: 'Cerveza Águila Light', price: 4500, cost: 3000, stock: 50, min_stock: 10 },
      { name: 'Cerveza Coronita', price: 6000, cost: 4200, stock: 40, min_stock: 8 }
    ];

    for (const prod of seedProducts) {
      await db.query(
        `INSERT INTO products 
          (business_id, name, price, cost, stock, min_stock, unit_type, is_service)
         VALUES ($1, $2, $3, $4, $5, $6, 'unidad', false)`,
        [newBusiness.id, prod.name, prod.price, prod.cost, prod.stock, prod.min_stock]
      );
    }

    // 7. Generar JWT Token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, businessId: newBusiness.id },
      process.env.JWT_SECRET || 'desarrollo_secreto_negocioai_2026_jwt_token_key',
      { expiresIn: '30d' }
    );

    // 8. Respuesta exitosa
    res.status(201).json({
      message: '¡Registro exitoso! Tu negocio ha sido configurado.',
      token,
      user: {
        id: newUser.id,
        full_name: newUser.full_name,
        email: newUser.email
      },
      business: newBusiness
    });
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({ error: 'Error al procesar el registro. Inténtalo de nuevo.' });
  }
};

// Inicio de Sesión (Login)
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Por favor ingresa tu correo y contraseña.' });
  }

  try {
    // 1. Buscar usuario
    const userResult = await db.query(
      'SELECT id, full_name, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo o contraseña.' });
    }

    const user = userResult.rows[0];

    // 2. Verificar contraseña con bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo o contraseña.' });
    }

    // 3. Buscar el negocio del usuario
    const businessResult = await db.query(
      'SELECT id, name, business_type_id, city, currency FROM businesses WHERE user_id = $1 LIMIT 1',
      [user.id]
    );

    const business = businessResult.rows[0] || null;

    // 4. Generar Token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, businessId: business ? business.id : null },
      process.env.JWT_SECRET || 'desarrollo_secreto_negocioai_2026_jwt_token_key',
      { expiresIn: '30d' }
    );

    res.json({
      message: '¡Bienvenido de nuevo!',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email
      },
      business
    });
  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión. Inténtalo de nuevo.' });
  }
};

// Obtener perfil autenticado
const getProfile = async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT id, full_name, email, phone, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const businessResult = await db.query(
      'SELECT id, name, business_type_id, city, currency FROM businesses WHERE user_id = $1 LIMIT 1',
      [req.user.userId]
    );

    res.json({
      user: userResult.rows[0],
      business: businessResult.rows[0] || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener perfil del usuario.' });
  }
};

module.exports = {
  register,
  login,
  getProfile
};
