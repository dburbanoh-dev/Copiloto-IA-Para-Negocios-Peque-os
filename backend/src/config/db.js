const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let localDb = {
  users: [],
  business_types: [
    { id: 'tienda', name: 'Tienda de Barrio / Minimercado', description: 'Venta de abarrotes' },
    { id: 'barberia', name: 'Barbería / Peluquería', description: 'Cortes y estética' },
    { id: 'papeleria', name: 'Papelería / Variedades', description: 'Útiles e impresiones' },
    { id: 'bar', name: 'Bar / Licorera', description: 'Bebidas y licores' },
    { id: 'restaurante', name: 'Restaurante', description: 'Comidas preparadas' },
    { id: 'emprendimiento', name: 'Emprendimiento / Tienda Virtual', description: 'Ventas generales' },
    { id: 'otro', name: 'Otro Pequeño Comercio', description: 'Comercio local' }
  ],
  businesses: [],
  categories: [],
  products: [],
  customers: [],
  sales: [],
  sale_items: [],
  expenses: [],
  receivables: [],
  inventory_movements: []
};

if (fs.existsSync(DB_FILE)) {
  try {
    const rawData = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(rawData);
    localDb = { ...localDb, ...parsed };
  } catch (err) {
    console.error('Error al leer db.json, reinicializando...');
  }
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify(localDb, null, 2));
}

const saveDb = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(localDb, null, 2));
  } catch (err) {
    console.error('Error al guardar en db.json:', err);
  }
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/negocioai',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

let isPostgresConnected = false;

pool.connect((err, client, release) => {
  if (err) {
    console.log('💡 [Persistencia Activa] Guardando datos en local /data/db.json.');
    isPostgresConnected = false;
  } else {
    console.log('✅ Conectado exitosamente a PostgreSQL.');
    isPostgresConnected = true;
    release();
  }
});

// Motor de consultas relacionales locales inteligentes
const executeLocalQuery = (text, params = []) => {
  const normalized = text.toLowerCase().trim();

  // 1. USERS
  if (normalized.includes('select id from users where email')) {
    const email = (params[0] || '').toLowerCase().trim();
    const found = localDb.users.filter(u => u.email.toLowerCase() === email);
    return Promise.resolve({ rows: found });
  }

  if (normalized.includes('insert into users')) {
    const id = crypto.randomUUID();
    const newUser = {
      id,
      full_name: params[0],
      email: (params[1] || '').toLowerCase().trim(),
      password_hash: params[2],
      phone: params[3] || null,
      created_at: new Date().toISOString()
    };
    localDb.users.push(newUser);
    saveDb();
    return Promise.resolve({ rows: [newUser] });
  }

  if (normalized.includes('from users where email')) {
    const email = (params[0] || '').toLowerCase().trim();
    const found = localDb.users.filter(u => u.email.toLowerCase() === email);
    return Promise.resolve({ rows: found });
  }

  if (normalized.includes('from users where id')) {
    const userId = params[0];
    const found = localDb.users.filter(u => u.id === userId);
    return Promise.resolve({ rows: found });
  }

  // 2. CUSTOMERS
  if (normalized.includes('from customers')) {
    const busId = params[0];
    const custName = params[1];
    let filtered = localDb.customers.filter(c => c.business_id === busId);
    if (custName) {
      filtered = filtered.filter(c => c.name.toLowerCase() === custName.toLowerCase());
    }
    return Promise.resolve({ rows: filtered });
  }

  if (normalized.includes('insert into customers')) {
    const id = crypto.randomUUID();
    const newCust = {
      id,
      business_id: params[0],
      name: params[1],
      phone: params[2] || null,
      notes: params[3] || null,
      created_at: new Date().toISOString()
    };
    localDb.customers.push(newCust);
    saveDb();
    return Promise.resolve({ rows: [newCust] });
  }

  // 3. BUSINESSES
  if (normalized.includes('insert into businesses')) {
    const id = crypto.randomUUID();
    const newBus = {
      id,
      user_id: params[0],
      business_type_id: params[1],
      name: params[2],
      city: params[3] || 'Medellín',
      currency: 'COP',
      created_at: new Date().toISOString()
    };
    localDb.businesses.push(newBus);
    saveDb();
    return Promise.resolve({ rows: [newBus] });
  }

  if (normalized.includes('from businesses where user_id')) {
    const userId = params[0];
    const found = localDb.businesses.filter(b => b.user_id === userId);
    return Promise.resolve({ rows: found });
  }

  // 4. BUSINESS_TYPES
  if (normalized.includes('from business_types')) {
    return Promise.resolve({ rows: localDb.business_types });
  }

  // 5. PRODUCTS
  if (normalized.includes('from products')) {
    if (normalized.includes('where id = $1 and business_id = $2') || normalized.includes('where p.id = $1 and p.business_id = $2')) {
      const productId = params[0];
      const busId = params[1];
      const found = localDb.products.filter(p => p.id === productId && p.business_id === busId);
      return Promise.resolve({ rows: found });
    }

    if (normalized.includes('where id = $1')) {
      const productId = params[0];
      const found = localDb.products.filter(p => p.id === productId);
      return Promise.resolve({ rows: found });
    }

    const busId = params[0];
    let filtered = localDb.products.filter(p => p.business_id === busId);

    if (normalized.includes('is_active')) {
      filtered = filtered.filter(p => p.is_active !== false);
    }

    return Promise.resolve({ rows: filtered });
  }

  if (normalized.includes('update products set')) {
    const productId = params[params.length - 1];
    const prodIndex = localDb.products.findIndex(p => p.id === productId || p.id === params[1] || p.id === params[0]);
    if (prodIndex !== -1) {
      if (normalized.includes('stock = $1')) {
        localDb.products[prodIndex].stock = Number(params[0]);
      }
      saveDb();
      return Promise.resolve({ rows: [localDb.products[prodIndex]] });
    }
    return Promise.resolve({ rows: [] });
  }

  if (normalized.includes('insert into products')) {
    const id = crypto.randomUUID();
    const newProd = {
      id,
      business_id: params[0],
      category_id: params[1],
      name: params[2],
      barcode: params[3],
      price: Number(params[4] || 0),
      cost: Number(params[5] || 0),
      stock: Number(params[6] || 0),
      min_stock: Number(params[7] || 5),
      unit_type: params[8] || 'unidad',
      is_service: Boolean(params[9]),
      is_active: true,
      created_at: new Date().toISOString()
    };
    localDb.products.push(newProd);
    saveDb();
    return Promise.resolve({ rows: [newProd] });
  }

  // 6. SALES
  if (normalized.includes('from sales')) {
    const busId = params[0];
    const filtered = busId ? localDb.sales.filter(s => s.business_id === busId) : localDb.sales;

    const withItems = filtered.map(s => {
      const items = localDb.sale_items.filter(item => item.sale_id === s.id);
      const summaryList = items.map(item => {
        const prod = localDb.products.find(p => p.id === item.product_id);
        const prodName = prod ? prod.name : 'Producto';
        return `${item.quantity}x ${prodName}`;
      });
      return {
        ...s,
        items_summary: summaryList.length > 0 ? summaryList.join(', ') : 'Venta Registrada'
      };
    });

    return Promise.resolve({ rows: withItems });
  }

  if (normalized.includes('insert into sales')) {
    const id = crypto.randomUUID();
    const newSale = {
      id,
      business_id: params[0],
      customer_id: params[1],
      total_amount: Number(params[2] || 0),
      payment_method: params[3] || 'cash',
      status: 'completed',
      notes: params[4] || null,
      created_at: new Date().toISOString()
    };
    localDb.sales.push(newSale);
    saveDb();
    return Promise.resolve({ rows: [newSale] });
  }

  if (normalized.includes('insert into sale_items')) {
    const id = crypto.randomUUID();
    const newItem = {
      id,
      sale_id: params[0],
      product_id: params[1],
      quantity: Number(params[2]),
      unit_price: Number(params[3]),
      subtotal: Number(params[4])
    };
    localDb.sale_items.push(newItem);
    saveDb();
    return Promise.resolve({ rows: [newItem] });
  }

  // 7. EXPENSES
  if (normalized.includes('from expenses')) {
    const busId = params[0];
    const filtered = busId ? localDb.expenses.filter(e => e.business_id === busId) : localDb.expenses;
    return Promise.resolve({ rows: filtered });
  }

  if (normalized.includes('insert into expenses')) {
    const id = crypto.randomUUID();
    const newExp = {
      id,
      business_id: params[0],
      description: params[1],
      category: params[2],
      amount: Number(params[3] || 0),
      payment_method: params[4] || 'cash',
      date: params[5] || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };
    localDb.expenses.push(newExp);
    saveDb();
    return Promise.resolve({ rows: [newExp] });
  }

  // 8. RECEIVABLES
  if (normalized.includes('delete from receivables')) {
    const recId = params[0];
    const recIndex = localDb.receivables.findIndex(r => r.id === recId);
    if (recIndex !== -1) {
      const deleted = localDb.receivables.splice(recIndex, 1);
      saveDb();
      return Promise.resolve({ rows: deleted });
    }
    return Promise.resolve({ rows: [] });
  }

  if (normalized.includes('from receivables')) {
    if (normalized.includes('where id = $1 and business_id = $2') || normalized.includes('where r.id = $1 and r.business_id = $2')) {
      const recId = params[0];
      const busId = params[1];
      const found = localDb.receivables.filter(r => r.id === recId && r.business_id === busId);
      return Promise.resolve({ rows: found });
    }

    if (normalized.includes('where id = $1')) {
      const recId = params[0];
      const found = localDb.receivables.filter(r => r.id === recId);
      return Promise.resolve({ rows: found });
    }

    const busId = params[0];
    const filtered = (busId ? localDb.receivables.filter(r => r.business_id === busId) : localDb.receivables).map(r => {
      const cust = localDb.customers.find(c => c.id === r.customer_id);
      return {
        ...r,
        customer_name: cust ? cust.name : 'Cliente',
        customer_phone: cust ? cust.phone : null
      };
    });
    return Promise.resolve({ rows: filtered });
  }

  if (normalized.includes('update receivables set paid_amount')) {
    const paidVal = Number(params[0]);
    const statusVal = params[1];
    const recId = params[2];

    const recIndex = localDb.receivables.findIndex(r => r.id === recId);
    if (recIndex !== -1) {
      localDb.receivables[recIndex].paid_amount = paidVal;
      localDb.receivables[recIndex].status = statusVal;
      saveDb();
      return Promise.resolve({ rows: [localDb.receivables[recIndex]] });
    }
    return Promise.resolve({ rows: [] });
  }

  if (normalized.includes('insert into receivables')) {
    const id = crypto.randomUUID();
    const newRec = {
      id,
      business_id: params[0],
      customer_id: params[1],
      total_amount: Number(params[2] || 0),
      paid_amount: Number(params[3] || 0),
      status: 'pending',
      due_date: params[3] || null,
      concept: params[4] || 'Fiado registrado en tienda',
      notes: params[5] || null,
      created_at: new Date().toISOString()
    };
    localDb.receivables.push(newRec);
    saveDb();
    return Promise.resolve({ rows: [newRec] });
  }

  // 9. INVENTORY MOVEMENTS
  if (normalized.includes('insert into inventory_movements')) {
    const id = crypto.randomUUID();
    const newMov = {
      id,
      business_id: params[0],
      product_id: params[1],
      type: params[2],
      quantity: params[3],
      previous_stock: params[4],
      new_stock: params[5],
      reason: params[6],
      created_at: new Date().toISOString()
    };
    localDb.inventory_movements.push(newMov);
    saveDb();
    return Promise.resolve({ rows: [newMov] });
  }

  return Promise.resolve({ rows: [] });
};

module.exports = {
  query: async (text, params) => {
    if (isPostgresConnected) {
      try {
        return await pool.query(text, params);
      } catch (err) {
        return executeLocalQuery(text, params);
      }
    }
    return executeLocalQuery(text, params);
  },
  pool: {
    connect: async () => {
      if (isPostgresConnected) {
        return pool.connect();
      }
      return {
        query: (text, params) => executeLocalQuery(text, params),
        release: () => {}
      };
    }
  }
};
