const db = require('../config/db');

// 1. Obtener todos los productos y servicios del negocio
const getProducts = async (req, res) => {
  const { businessId } = req.user;
  const { search, category_id, is_service, active_only } = req.query;

  try {
    let queryText = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.business_id = $1
    `;
    const queryParams = [businessId];

    // Filtros opcionales
    if (active_only === 'true') {
      queryParams.push(true);
      queryText += ` AND p.is_active = $${queryParams.length}`;
    }

    if (is_service !== undefined && is_service !== '') {
      queryParams.push(is_service === 'true');
      queryText += ` AND p.is_service = $${queryParams.length}`;
    }

    if (category_id) {
      queryParams.push(category_id);
      queryText += ` AND p.category_id = $${queryParams.length}`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      queryText += ` AND (p.name ILIKE $${queryParams.length} OR p.barcode ILIKE $${queryParams.length})`;
    }

    queryText += ` ORDER BY p.name ASC`;

    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al consultar catálogo de productos.' });
  }
};

// 2. Obtener un producto específico por ID
const getProductById = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT p.*, c.name as category_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       WHERE p.id = $1 AND p.business_id = $2`,
      [id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto o servicio no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar producto.' });
  }
};

// 3. Crear un nuevo producto o servicio
const createProduct = async (req, res) => {
  const { businessId } = req.user;
  const {
    name,
    category_id,
    barcode,
    price,
    cost,
    stock,
    min_stock,
    unit_type,
    is_service
  } = req.body;

  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'El nombre y el precio de venta son obligatorios.' });
  }

  try {
    const isServiceBool = Boolean(is_service);
    const initialStock = isServiceBool ? 0 : Number(stock || 0);
    const minStockVal = isServiceBool ? 0 : Number(min_stock || 5);

    const result = await db.query(
      `INSERT INTO products 
        (business_id, category_id, name, barcode, price, cost, stock, min_stock, unit_type, is_service)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        businessId,
        category_id || null,
        name.trim(),
        barcode || null,
        Number(price),
        Number(cost || 0),
        initialStock,
        minStockVal,
        unit_type || 'unidad',
        isServiceBool
      ]
    );

    const newProduct = result.rows[0];

    // Si es un producto físico con stock inicial > 0, registrar movimiento inicial en Kardex
    if (!isServiceBool && initialStock > 0) {
      await db.query(
        `INSERT INTO inventory_movements 
          (business_id, product_id, type, quantity, previous_stock, new_stock, reason)
         VALUES ($1, $2, 'initial', $3, 0, $3, 'Inventario inicial al crear producto')`,
        [businessId, newProduct.id, initialStock]
      );
    }

    res.status(201).json({
      message: `${isServiceBool ? 'Servicio' : 'Producto'} creado exitosamente.`,
      product: newProduct
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error al guardar producto o servicio.' });
  }
};

// 4. Actualizar un producto o servicio existente
const updateProduct = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;
  const {
    name,
    category_id,
    barcode,
    price,
    cost,
    stock,
    min_stock,
    unit_type,
    is_service,
    is_active
  } = req.body;

  try {
    // Verificar propiedad
    const existing = await db.query('SELECT * FROM products WHERE id = $1 AND business_id = $2', [id, businessId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const current = existing.rows[0];
    const isServiceBool = is_service !== undefined ? Boolean(is_service) : current.is_service;
    const newStock = isServiceBool ? 0 : (stock !== undefined ? Number(stock) : current.stock);

    const result = await db.query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           category_id = $2,
           barcode = $3,
           price = COALESCE($4, price),
           cost = COALESCE($5, cost),
           stock = $6,
           min_stock = COALESCE($7, min_stock),
           unit_type = COALESCE($8, unit_type),
           is_service = $9,
           is_active = COALESCE($10, is_active),
           updated_at = NOW()
       WHERE id = $11 AND business_id = $12
       RETURNING *`,
      [
        name ? name.trim() : null,
        category_id !== undefined ? category_id : current.category_id,
        barcode !== undefined ? barcode : current.barcode,
        price !== undefined ? Number(price) : null,
        cost !== undefined ? Number(cost) : null,
        newStock,
        min_stock !== undefined ? Number(min_stock) : null,
        unit_type || null,
        isServiceBool,
        is_active !== undefined ? Boolean(is_active) : null,
        id,
        businessId
      ]
    );

    // Si cambió el stock manualmente, registrar ajuste en Kardex
    if (!isServiceBool && stock !== undefined && Number(stock) !== Number(current.stock)) {
      const diff = Number(stock) - Number(current.stock);
      await db.query(
        `INSERT INTO inventory_movements 
          (business_id, product_id, type, quantity, previous_stock, new_stock, reason)
         VALUES ($1, $2, 'adjustment', $3, $4, $5, 'Ajuste manual de stock')`,
        [businessId, id, diff, current.stock, stock]
      );
    }

    res.json({
      message: 'Producto actualizado exitosamente.',
      product: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error al actualizar el producto.' });
  }
};

// 5. Eliminar / Desactivar producto (Soft Delete)
const toggleProductStatus = async (req, res) => {
  const { businessId } = req.user;
  const { id } = req.params;

  try {
    const result = await db.query(
      `UPDATE products 
       SET is_active = NOT is_active, updated_at = NOW() 
       WHERE id = $1 AND business_id = $2 
       RETURNING id, name, is_active`,
      [id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const item = result.rows[0];
    res.json({
      message: `El elemento "${item.name}" ahora está ${item.is_active ? 'activo' : 'inactivo'}.`,
      product: item
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado del producto.' });
  }
};

// 6. Obtener categorías de catálogo
const getCategories = async (req, res) => {
  const { businessId } = req.user;
  try {
    const result = await db.query(
      'SELECT * FROM categories WHERE business_id = $1 ORDER BY name ASC',
      [businessId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categorías.' });
  }
};

// 7. Crear nueva categoría
const createCategory = async (req, res) => {
  const { businessId } = req.user;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre de la categoría es requerido.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO categories (business_id, name) VALUES ($1, $2) RETURNING *',
      [businessId, name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear categoría.' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductStatus,
  getCategories,
  createCategory
};
