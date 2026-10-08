const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');
const crypto = require('crypto');

function toUuid(id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;
  // Generate deterministic uuid from string
  const hash = crypto.createHash('md5').update(String(id)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function migrate() {
  const jsonPath = path.join(__dirname, '../data/db.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('No db.json found to migrate.');
    process.exit(0);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('--- Migrando datos desde db.json a PostgreSQL ---');

    // 1. Users
    for (const u of data.users || []) {
      const uId = toUuid(u.id);
      await client.query(
        `INSERT INTO users (id, email, password_hash, full_name, phone, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash`,
        [uId, u.email, u.password_hash, u.full_name, u.phone || null, u.created_at || new Date()]
      );
    }
    console.log(`✅ ${(data.users || []).length} usuarios migrados.`);

    // 2. Businesses
    for (const b of data.businesses || []) {
      const bId = toUuid(b.id);
      const uId = toUuid(b.user_id);
      await client.query(
        `INSERT INTO businesses (id, user_id, business_type_id, name, city, currency, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [bId, uId, b.business_type_id || 'otro', b.name, b.city || 'Medellín', b.currency || 'COP', b.created_at || new Date()]
      );
    }
    console.log(`✅ ${(data.businesses || []).length} negocios migrados.`);

    // 2.5 Categories
    const validCategoryIds = new Set();
    for (const cat of data.categories || []) {
      const catId = toUuid(cat.id);
      validCategoryIds.add(catId);
      await client.query(
        `INSERT INTO categories (id, business_id, name, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [catId, toUuid(cat.business_id), cat.name, cat.created_at || new Date()]
      );
    }
    console.log(`✅ ${(data.categories || []).length} categorías migradas.`);

    // 3. Products
    const productIdMap = {};
    for (const p of data.products || []) {
      const oldId = p.id;
      const newId = toUuid(oldId);
      productIdMap[oldId] = newId;

      const pCatId = p.category_id ? toUuid(p.category_id) : null;
      const safeCatId = validCategoryIds.has(pCatId) ? pCatId : null;

      await client.query(
        `INSERT INTO products (id, business_id, category_id, name, barcode, price, cost, stock, min_stock, unit_type, is_service, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        [
          newId,
          toUuid(p.business_id),
          safeCatId,
          p.name,
          p.barcode || null,
          Number(p.price || 0),
          Number(p.cost || 0),
          Number(p.stock || 0),
          Number(p.min_stock || 5),
          p.unit_type || 'unidad',
          Boolean(p.is_service),
          p.is_active !== undefined ? Boolean(p.is_active) : true,
          p.created_at || new Date()
        ]
      );
    }
    console.log(`✅ ${(data.products || []).length} productos migrados.`);

    // 4. Customers
    const customerIdMap = {};
    for (const c of data.customers || []) {
      const oldId = c.id;
      const newId = toUuid(oldId);
      customerIdMap[oldId] = newId;

      await client.query(
        `INSERT INTO customers (id, business_id, name, phone, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          newId,
          toUuid(c.business_id),
          c.name,
          c.phone || null,
          c.notes || null,
          c.created_at || new Date()
        ]
      );
    }
    console.log(`✅ ${(data.customers || []).length} clientes migrados.`);

    // 5. Sales
    for (const s of data.sales || []) {
      const sId = toUuid(s.id);
      await client.query(
        `INSERT INTO sales (id, business_id, customer_id, total_amount, payment_method, status, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          sId,
          toUuid(s.business_id),
          s.customer_id ? (customerIdMap[s.customer_id] || toUuid(s.customer_id)) : null,
          Number(s.total_amount || 0),
          s.payment_method || 'cash',
          s.status || 'completed',
          s.notes || null,
          s.created_at || new Date()
        ]
      );
    }
    console.log(`✅ ${(data.sales || []).length} ventas migradas.`);

    // 6. Sale Items
    for (const si of data.sale_items || []) {
      const siId = toUuid(si.id);
      const prodId = productIdMap[si.product_id] || toUuid(si.product_id);
      await client.query(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          siId,
          toUuid(si.sale_id),
          prodId,
          Number(si.quantity || 1),
          Number(si.unit_price || 0),
          Number(si.subtotal || 0)
        ]
      );
    }
    console.log(`✅ ${(data.sale_items || []).length} items de venta migrados.`);

    // 7. Receivables
    for (const r of data.receivables || []) {
      const rId = toUuid(r.id);
      const custId = customerIdMap[r.customer_id] || toUuid(r.customer_id);
      await client.query(
        `INSERT INTO receivables (id, business_id, customer_id, sale_id, total_amount, paid_amount, status, concept, notes, due_date, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          rId,
          toUuid(r.business_id),
          custId,
          r.sale_id ? toUuid(r.sale_id) : null,
          Number(r.total_amount || 0),
          Number(r.paid_amount || 0),
          r.status || 'pending',
          r.concept || 'Fiado registrado en tienda',
          r.notes || null,
          r.due_date ? new Date(r.due_date) : null,
          r.created_at || new Date()
        ]
      );
    }
    console.log(`✅ ${(data.receivables || []).length} fiados/cuentas por cobrar migrados.`);

    await client.query('COMMIT');
    console.log('🎉 Migración completada exitosamente a PostgreSQL.');

    // Backup db.json to db.json.bak
    const bakPath = path.join(__dirname, '../data/db.json.bak');
    fs.renameSync(jsonPath, bakPath);
    console.log('📁 db.json renombrado a db.json.bak (ya no se usará).');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
