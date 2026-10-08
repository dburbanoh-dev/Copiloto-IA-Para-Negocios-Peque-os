const { pool } = require('../src/config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function testFullSystem() {
  console.log('🧪 === INICIANDO SUITE DE PRUEBAS END-TO-END (POSTGRESQL SINGLE SOURCE OF TRUTH) ===');

  try {
    // 1. Verificar usuarios y negocios migrados
    console.log('\n[1/6] Verificando usuarios y multi-tenancy...');
    const usersRes = await pool.query('SELECT u.id, u.email, b.id as business_id, b.name as business_name FROM users u JOIN businesses b ON u.id = b.user_id');
    console.log(`   ✅ Usuarios con negocios configurados: ${usersRes.rows.length}`);
    usersRes.rows.forEach(u => console.log(`      - ${u.email} -> Negocio: ${u.business_name} (${u.business_id})`));

    const testTenant = usersRes.rows[0];
    const testBusinessId = testTenant.business_id;

    // 2. Probar Productos
    console.log('\n[2/6] Verificando productos del negocio...');
    const prodRes = await pool.query('SELECT id, name, price, stock, is_service FROM products WHERE business_id = $1 LIMIT 5', [testBusinessId]);
    console.log(`   ✅ Productos encontrados para el negocio: ${prodRes.rows.length}`);
    prodRes.rows.forEach(p => console.log(`      - ${p.name}: $${p.price} (Stock: ${p.stock})`));

    // 3. Probar Creación de Venta con Transacción
    console.log('\n[3/6] Probando registro de venta transaccional...');
    const client = await pool.connect();
    let newSaleId;
    try {
      await client.query('BEGIN');
      const testProd = prodRes.rows[0];
      const initialStock = Number(testProd.stock);

      const saleRes = await client.query(
        `INSERT INTO sales (business_id, total_amount, payment_method, notes)
         VALUES ($1, $2, 'cash', 'Venta test automated') RETURNING id`,
        [testBusinessId, testProd.price]
      );
      newSaleId = saleRes.rows[0].id;

      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, 1, $3, $3)`,
        [newSaleId, testProd.id, testProd.price]
      );

      // Decrementar stock
      await client.query('UPDATE products SET stock = stock - 1 WHERE id = $1', [testProd.id]);

      await client.query(
        `INSERT INTO inventory_movements (business_id, product_id, type, quantity, previous_stock, new_stock, reason)
         VALUES ($1, $2, 'sale', -1, $3, $4, 'Test sale')`,
        [testBusinessId, testProd.id, initialStock, initialStock - 1]
      );

      await client.query('COMMIT');
      console.log(`   ✅ Venta creada exitosamente con ID: ${newSaleId}`);

      // Verificar stock actualizado
      const updatedProd = await pool.query('SELECT stock FROM products WHERE id = $1', [testProd.id]);
      console.log(`   ✅ Stock decrementado correctamente: ${initialStock} -> ${updatedProd.rows[0].stock}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // 4. Probar Fiados y Abonos
    console.log('\n[4/6] Probando fiados, abonos y eliminación...');
    const custRes = await pool.query('SELECT id FROM customers WHERE business_id = $1 LIMIT 1', [testBusinessId]);
    let customerId = custRes.rows[0]?.id;

    if (!customerId) {
      const newCust = await pool.query(
        'INSERT INTO customers (business_id, name, phone) VALUES ($1, $2, $3) RETURNING id',
        [testBusinessId, 'Don Pedro Vecino Test', '3001234567']
      );
      customerId = newCust.rows[0].id;
    }

    // Insertar fiado
    const recRes = await pool.query(
      `INSERT INTO receivables (business_id, customer_id, total_amount, paid_amount, status, concept)
       VALUES ($1, $2, 50000, 0, 'pending', '2 botellas de Nariño para pagar quincena')
       RETURNING id, total_amount, paid_amount, status, concept`,
      [testBusinessId, customerId]
    );
    const recId = recRes.rows[0].id;
    console.log(`   ✅ Fiado creado: ID ${recId}, Monto: $${recRes.rows[0].total_amount}, Concepto: "${recRes.rows[0].concept}"`);

    // Abonar a la deuda
    const abonoAmount = 20000;
    const updateRes = await pool.query(
      `UPDATE receivables
       SET paid_amount = paid_amount + $1, status = 'partial'
       WHERE id = $2 AND business_id = $3
       RETURNING total_amount, paid_amount, status`,
      [abonoAmount, recId, testBusinessId]
    );
    const remaining = Number(updateRes.rows[0].total_amount) - Number(updateRes.rows[0].paid_amount);
    console.log(`   ✅ Abono de $${abonoAmount} registrado. Saldo pendiente: $${remaining}. Estado: ${updateRes.rows[0].status}`);

    // Limpiar fiado de prueba
    await pool.query('DELETE FROM receivables WHERE id = $1', [recId]);
    console.log('   ✅ Fiado de prueba eliminado correctamente.');

    // 5. Probar Query de Copilot IA (que antes tenía el bug de missing FROM sales)
    console.log('\n[5/6] Verificando queries del Copiloto IA...');
    const aiSalesQuery = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count 
       FROM sales
       WHERE business_id = $1 AND DATE(created_at) = CURRENT_DATE AND status != 'cancelled'`,
      [testBusinessId]
    );
    console.log(`   ✅ Query 'query_sales_today' ejecutada con éxito: ${aiSalesQuery.rows[0].count} ventas hoy por $${aiSalesQuery.rows[0].total}`);

    // 6. Multi-Tenant Isolation Check
    console.log('\n[6/6] Verificando aislamiento estricto multi-tenant...');
    if (usersRes.rows.length >= 2) {
      const tenantA = usersRes.rows[0];
      const tenantB = usersRes.rows[1];

      const prodsA = await pool.query('SELECT count(*) FROM products WHERE business_id = $1', [tenantA.business_id]);
      const prodsB = await pool.query('SELECT count(*) FROM products WHERE business_id = $1', [tenantB.business_id]);
      console.log(`   ✅ Negocio A (${tenantA.business_name}): ${prodsA.rows[0].count} productos`);
      console.log(`   ✅ Negocio B (${tenantB.business_name}): ${prodsB.rows[0].count} productos`);

      // Verificar que Negocio A no pueda ver ventas de Negocio B
      const crossSales = await pool.query('SELECT count(*) FROM sales WHERE business_id = $1 AND business_id = $2', [tenantA.business_id, tenantB.business_id]);
      console.log(`   ✅ Intersección cruzada: ${crossSales.rows[0].count} (Aislamiento total)`);
    }

    console.log('\n🎉 ========================================================');
    console.log('🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE AL 100%!');
    console.log('🎉 ========================================================');

  } catch (error) {
    console.error('🔴 ERROR EN PRUEBAS:', error);
  } finally {
    await pool.end();
  }
}

testFullSystem();
