const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Registro de Usuario y Creación de Negocio Inicial Modular
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

    // 5. Obtener los módulos por defecto según el tipo de negocio
    const typeRes = await db.query('SELECT default_modules FROM business_types WHERE id = $1', [business_type_id]);
    const defaultModules = (typeRes.rows.length > 0 && typeRes.rows[0].default_modules) 
      ? typeRes.rows[0].default_modules 
      : ['pos', 'inventory', 'expenses', 'reports'];

    // 6. Crear el Negocio asociado al Usuario con sus módulos configurados
    const businessResult = await db.query(
      `INSERT INTO businesses (user_id, business_type_id, name, city, enabled_modules) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, business_type_id, city, currency, enabled_modules, settings`,
      [newUser.id, business_type_id, business_name, city || 'Medellín', defaultModules]
    );

    const newBusiness = businessResult.rows[0];

    // 7. Cargar catálogo semilla adaptado inteligentemente al tipo de negocio
    if (business_type_id === 'barberia') {
      // Semilla para Barbería / Estética (Servicios + Productos capilares + Barbero inicial)
      const barberServices = [
        { name: 'Corte Clásico / Degradado (Fade)', price: 20000, duration: 40, is_service: true },
        { name: 'Arreglo y Perfilado de Barba', price: 15000, duration: 25, is_service: true },
        { name: 'Combo Corte + Barba VIP', price: 30000, duration: 60, is_service: true },
        { name: 'Limpieza Facial / Mascarilla Negra', price: 18000, duration: 30, is_service: true },
        { name: 'Cera Moldeadora Efecto Mate', price: 25000, cost: 14000, stock: 15, is_service: false },
        { name: 'Aceite Nutritivo para Barba', price: 28000, cost: 16000, stock: 10, is_service: false }
      ];

      for (const item of barberServices) {
        await db.query(
          `INSERT INTO products 
            (business_id, name, price, cost, stock, min_stock, unit_type, is_service, duration_minutes)
           VALUES ($1, $2, $3, $4, $5, 3, 'unidad', $6, $7)`,
          [newBusiness.id, item.name, item.price, item.cost || 0, item.stock || 0, item.is_service, item.duration || 30]
        );
      }

      // Empleado barbero inicial
      await db.query(
        `INSERT INTO staff (business_id, name, role, commission_pct)
         VALUES ($1, $2, 'barbero', 50.00)`,
        [newBusiness.id, full_name]
      );

    } else if (business_type_id === 'tienda') {
      // Semilla para Tienda de Barrio / Minimercado
      const tiendaProducts = [
        { name: 'Leche Entera 1 Litro', price: 4200, cost: 3300, stock: 30, min_stock: 8 },
        { name: 'Arroz Diana 1 kg', price: 4800, cost: 3900, stock: 40, min_stock: 10 },
        { name: 'Huevos AA x30 (Cubeta)', price: 18000, cost: 15000, stock: 15, min_stock: 4 },
        { name: 'Aceite Vegetal 900ml', price: 9500, cost: 7800, stock: 20, min_stock: 5 },
        { name: 'Pan Tajado Bimbo', price: 6200, cost: 4800, stock: 12, min_stock: 3 },
        { name: 'Gaseosa Coca-Cola 1.5L', price: 6000, cost: 4600, stock: 24, min_stock: 6 }
      ];

      for (const prod of tiendaProducts) {
        await db.query(
          `INSERT INTO products 
            (business_id, name, price, cost, stock, min_stock, unit_type, is_service)
           VALUES ($1, $2, $3, $4, $5, $6, 'unidad', false)`,
          [newBusiness.id, prod.name, prod.price, prod.cost, prod.stock, prod.min_stock]
        );
      }

    } else if (business_type_id === 'papeleria') {
      // Semilla para Papelería
      const papeleriaItems = [
        { name: 'Cuaderno Cuadriculado 100 Hojas', price: 4500, cost: 3100, stock: 50, is_service: false },
        { name: 'Bolígrafo Kilométrico Negro', price: 1500, cost: 900, stock: 100, is_service: false },
        { name: 'Fotocopia Blanco y Negro', price: 200, cost: 40, stock: 0, is_service: true },
        { name: 'Impresión Color Carta', price: 1000, cost: 250, stock: 0, is_service: true },
        { name: 'Plastificado / Laminado Carnet', price: 3000, cost: 800, stock: 0, is_service: true },
        { name: 'Resma de Papel Carta Reprograf', price: 19500, cost: 15500, stock: 12, is_service: false }
      ];

      for (const item of papeleriaItems) {
        await db.query(
          `INSERT INTO products 
            (business_id, name, price, cost, stock, min_stock, unit_type, is_service)
           VALUES ($1, $2, $3, $4, $5, 5, 'unidad', $6)`,
          [newBusiness.id, item.name, item.price, item.cost || 0, item.stock || 0, item.is_service]
        );
      }

    } else {
      // Semilla por defecto para Bares / Otros
      const defaultProducts = [
        { name: 'Aguardiente Nariño', price: 45000, cost: 32000, stock: 25, min_stock: 5 },
        { name: 'Aguardiente Amarillo', price: 55000, cost: 40000, stock: 20, min_stock: 5 },
        { name: "Whisky Buchanan's", price: 140000, cost: 105000, stock: 15, min_stock: 3 },
        { name: 'Cerveza Poker', price: 4500, cost: 3000, stock: 60, min_stock: 10 },
        { name: 'Cerveza Águila Light', price: 4500, cost: 3000, stock: 50, min_stock: 10 },
        { name: 'Cerveza Coronita', price: 6000, cost: 4200, stock: 40, min_stock: 8 }
      ];

      for (const prod of defaultProducts) {
        await db.query(
          `INSERT INTO products 
            (business_id, name, price, cost, stock, min_stock, unit_type, is_service)
           VALUES ($1, $2, $3, $4, $5, $6, 'unidad', false)`,
          [newBusiness.id, prod.name, prod.price, prod.cost, prod.stock, prod.min_stock]
        );
      }
    }

    // 8. Generar JWT Token
    const jwtSecret = process.env.JWT_SECRET || 'desarrollo_secreto_negocioai_2026_jwt_token_key';
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, businessId: newBusiness.id },
      jwtSecret,
      { expiresIn: '30d' }
    );

    // 9. Respuesta exitosa con negocio y módulos habilitados
    res.status(201).json({
      message: '¡Registro exitoso! Tu espacio de trabajo ha sido configurado.',
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

// Inicio de Sesión (Login) con Módulos del Negocio
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

    // 3. Buscar el negocio del usuario con sus módulos activos y configuraciones
    const businessResult = await db.query(
      'SELECT id, name, business_type_id, city, currency, enabled_modules, settings FROM businesses WHERE user_id = $1 LIMIT 1',
      [user.id]
    );

    const business = businessResult.rows[0] || null;

    // 4. Generar Token JWT
    const jwtSecret = process.env.JWT_SECRET || 'desarrollo_secreto_negocioai_2026_jwt_token_key';
    const token = jwt.sign(
      { userId: user.id, email: user.email, businessId: business ? business.id : null },
      jwtSecret,
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

// Obtener perfil autenticado con configuración completa del negocio
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
      'SELECT id, name, business_type_id, city, currency, enabled_modules, settings FROM businesses WHERE user_id = $1 LIMIT 1',
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
