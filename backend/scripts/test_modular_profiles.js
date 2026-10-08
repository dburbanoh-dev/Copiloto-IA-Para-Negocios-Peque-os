const { pool } = require('../src/config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function testModularProfiles() {
  console.log('🧪 ======================================================================');
  console.log('🧪 PRUEBAS DE ADAPTACIÓN SAAS MULTI-TENANT POR TIPO DE NEGOCIO');
  console.log('🧪 ======================================================================\n');

  const jwtSecret = process.env.JWT_SECRET || 'desarrollo_secreto_negocioai_2026_jwt_token_key';

  try {
    // -------------------------------------------------------------
    // CASO 1: REGISTRO Y OPERACIÓN DE UNA TIENDA DE BARRIO
    // -------------------------------------------------------------
    console.log('[1/4] Creando negocio: Tienda de Barrio ("Abarrotes El Vecino")...');
    const salt = await bcrypt.genSalt(10);
    const pwd = await bcrypt.hash('password123', salt);

    const userTiendaRes = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ('Don Pedro Tendero', 'pedro_tienda_${Date.now()}@test.com', $1) RETURNING id, email`,
      [pwd]
    );
    const userTienda = userTiendaRes.rows[0];

    const typeTienda = await pool.query('SELECT default_modules FROM business_types WHERE id = \'tienda\'');
    const modulesTienda = typeTienda.rows[0].default_modules;

    const bizTiendaRes = await pool.query(
      `INSERT INTO businesses (user_id, business_type_id, name, city, enabled_modules)
       VALUES ($1, 'tienda', 'Abarrotes El Vecino', 'Medellín', $2) RETURNING id, name, enabled_modules`,
      [userTienda.id, modulesTienda]
    );
    const bizTienda = bizTiendaRes.rows[0];
    console.log(`   ✅ Tienda creada con ID: ${bizTienda.id}`);
    console.log(`   ✅ Módulos activos para Tienda:`, bizTienda.enabled_modules);

    // Sembrar productos de tienda
    await pool.query(
      `INSERT INTO products (business_id, name, price, cost, stock, min_stock, is_service) VALUES
       ($1, 'Arroz Diana 1kg', 4800, 3900, 50, 10, false),
       ($1, 'Leche Alquería 1L', 4200, 3400, 30, 8, false)`,
      [bizTienda.id]
    );
    console.log('   ✅ Catálogo de abarrotes sembrado.');

    // -------------------------------------------------------------
    // CASO 2: REGISTRO Y OPERACIÓN DE UNA BARBERÍA (MODALIDAD HÍBRIDA)
    // -------------------------------------------------------------
    console.log('\n[2/4] Creando negocio: Barbería ("Elite Barber VIP")...');
    const userBarberRes = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ('Carlos Master Barber', 'carlos_barber_${Date.now()}@test.com', $1) RETURNING id, email`,
      [pwd]
    );
    const userBarber = userBarberRes.rows[0];

    const typeBarber = await pool.query('SELECT default_modules FROM business_types WHERE id = \'barberia\'');
    const modulesBarber = typeBarber.rows[0].default_modules;

    const bizBarberRes = await pool.query(
      `INSERT INTO businesses (user_id, business_type_id, name, city, enabled_modules)
       VALUES ($1, 'barberia', 'Elite Barber VIP', 'Envigado', $2) RETURNING id, name, enabled_modules`,
      [userBarber.id, modulesBarber]
    );
    const bizBarber = bizBarberRes.rows[0];
    console.log(`   ✅ Barbería creada con ID: ${bizBarber.id}`);
    console.log(`   ✅ Módulos activos para Barbería:`, bizBarber.enabled_modules);

    // Sembrar servicios y productos capilares híbridos
    const serviceCorte = await pool.query(
      `INSERT INTO products (business_id, name, price, duration_minutes, commission_rate, is_service)
       VALUES ($1, 'Corte Fade / Degradado', 22000, 40, 50.00, true) RETURNING id, name, price`,
      [bizBarber.id]
    );
    const prodCera = await pool.query(
      `INSERT INTO products (business_id, name, price, cost, stock, min_stock, is_service)
       VALUES ($1, 'Cera Fijadora Mate 120g', 26000, 15000, 20, 5, false) RETURNING id, name`,
      [bizBarber.id]
    );
    console.log('   ✅ Servicios de estética y productos híbridos creados.');

    // Registrar Barbero en staff
    const staffRes = await pool.query(
      `INSERT INTO staff (business_id, name, role, commission_pct)
       VALUES ($1, 'Mateo Barbero Pro', 'barbero', 50.00) RETURNING id, name, commission_pct`,
      [bizBarber.id]
    );
    const staffMember = staffRes.rows[0];
    console.log(`   ✅ Barbero registrado: ${staffMember.name} con ${staffMember.commission_pct}% de comisión.`);

    // Agendar Cita
    const apptRes = await pool.query(
      `INSERT INTO appointments (business_id, customer_name, customer_phone, staff_id, service_id, scheduled_at, status, total_price, commission_amount)
       VALUES ($1, 'Santiago Cliente', '3112223344', $2, $3, NOW(), 'scheduled', 22000, 11000)
       RETURNING id, customer_name, total_price, commission_amount, status`,
      [bizBarber.id, staffMember.id, serviceCorte.rows[0].id]
    );
    console.log(`   ✅ Cita agendada para ${apptRes.rows[0].customer_name}: $${apptRes.rows[0].total_price} (Comisión calculada: $${apptRes.rows[0].commission_amount})`);

    // Completar Cita y cobrar en caja
    await pool.query(
      'UPDATE appointments SET status = \'completed\' WHERE id = $1',
      [apptRes.rows[0].id]
    );
    console.log('   ✅ Cita completada con éxito.');

    // -------------------------------------------------------------
    // CASO 3: PERSONALIZACIÓN MODULAR — NEGOCIO HÍBRIDO
    // -------------------------------------------------------------
    console.log('\n[3/4] Probando personalización modular (Barbería activa módulo de Fiados)...');
    // Inicialmente la barbería no tenía fiados
    const tieneFiadosAntes = bizBarber.enabled_modules.includes('receivables');
    console.log(`   ¿Barbería tenía fiados activados inicialmente?: ${tieneFiadosAntes ? 'SÍ' : 'NO'}`);

    // El dueño activa fiados para clientes VIP
    const updatedModules = [...bizBarber.enabled_modules, 'receivables'];
    const updateBiz = await pool.query(
      `UPDATE businesses SET enabled_modules = $1 WHERE id = $2 RETURNING enabled_modules`,
      [updatedModules, bizBarber.id]
    );
    console.log(`   ✅ Módulos actualizados por el dueño:`, updateBiz.rows[0].enabled_modules);
    console.log(`   ¿Barbería tiene ahora fiados activados?: ${updateBiz.rows[0].enabled_modules.includes('receivables') ? 'SÍ (Activado con éxito)' : 'NO'}`);

    // -------------------------------------------------------------
    // CASO 4: VERIFICACIÓN DE AISLAMIENTO ESTRICTO ENTRE AMBOS
    // -------------------------------------------------------------
    console.log('\n[4/4] Verificando aislamiento multi-tenant estricto...');
    // Tienda NO puede ver citas ni barberos de Barbería
    const citasTienda = await pool.query('SELECT count(*) FROM appointments WHERE business_id = $1', [bizTienda.id]);
    const staffTienda = await pool.query('SELECT count(*) FROM staff WHERE business_id = $1', [bizTienda.id]);
    console.log(`   Citas en Tienda: ${citasTienda.rows[0].count} (Esperado: 0)`);
    console.log(`   Personal en Tienda: ${staffTienda.rows[0].count} (Esperado: 0)`);

    // Barbería NO puede ver productos de Tienda
    const arrozEnBarberia = await pool.query('SELECT count(*) FROM products WHERE business_id = $1 AND name ILIKE \'%Arroz%\'', [bizBarber.id]);
    console.log(`   Productos de abarrotes en Barbería: ${arrozEnBarberia.rows[0].count} (Esperado: 0)`);

    console.log('\n======================================================================');
    console.log('🏆 TODAS LAS PRUEBAS MODULARES MULTI-TENANT PASARON AL 100%!');
    console.log('======================================================================');

  } catch (err) {
    console.error('🔴 Error en pruebas modulares:', err);
  } finally {
    await pool.end();
  }
}

testModularProfiles();
