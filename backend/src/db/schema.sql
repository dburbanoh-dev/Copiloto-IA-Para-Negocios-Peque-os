-- =====================================================
-- NEGOCIOAI — Schema Principal PostgreSQL
-- Versión: 3.0 (Arquitectura Modular Multi-Tenant SaaS)
-- =====================================================

-- Habilitar extensión para UUIDs en PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA DE USUARIOS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA DE TIPOS DE NEGOCIO
CREATE TABLE IF NOT EXISTS business_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    default_modules TEXT[] DEFAULT ARRAY['pos', 'inventory', 'expenses', 'reports']::TEXT[]
);

ALTER TABLE business_types ADD COLUMN IF NOT EXISTS default_modules TEXT[] DEFAULT ARRAY['pos', 'inventory', 'expenses', 'reports']::TEXT[];

-- Insertar / actualizar tipos de negocio con sus módulos iniciales recomendados
INSERT INTO business_types (id, name, description, default_modules) VALUES
('tienda', 'Tienda de Barrio / Minimercado', 'Venta de abarrotes, víveres y productos de consumo diario', ARRAY['pos', 'inventory', 'receivables', 'expenses', 'reports']::TEXT[]),
('barberia', 'Barbería / Peluquería', 'Servicios de estética, cortes de cabello, agenda y comisiones', ARRAY['services', 'appointments', 'staff', 'pos', 'expenses', 'reports']::TEXT[]),
('papeleria', 'Papelería / Variedades', 'Artículos escolares, útiles de oficina, copias e impresiones', ARRAY['pos', 'inventory', 'services', 'expenses', 'reports']::TEXT[]),
('bar', 'Bar / Discoteca / Licorera', 'Venta de bebidas alcohólicas, refrescos y control de cuentas', ARRAY['pos', 'inventory', 'tables', 'expenses', 'reports']::TEXT[]),
('restaurante', 'Restaurante Pequeño / Comida Rápida', 'Venta de alimentos preparados, comandas y cocina', ARRAY['pos', 'tables', 'kitchen', 'expenses', 'reports']::TEXT[]),
('emprendimiento', 'Emprendimiento / Tienda Online', 'Venta de productos artesanales o catálogo general', ARRAY['pos', 'inventory', 'receivables', 'expenses', 'reports']::TEXT[]),
('otro', 'Otro Pequeño Comercio', 'Otros tipos de comercios locales', ARRAY['pos', 'inventory', 'expenses', 'reports']::TEXT[])
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    default_modules = EXCLUDED.default_modules;

-- 3. TABLA DE NEGOCIOS (Multi-Tenant con Configuración Modular)
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_type_id VARCHAR(50) NOT NULL REFERENCES business_types(id),
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    city VARCHAR(100) DEFAULT 'Medellín',
    country VARCHAR(100) DEFAULT 'Colombia',
    currency VARCHAR(10) DEFAULT 'COP',
    enabled_modules TEXT[] DEFAULT ARRAY['pos', 'inventory', 'expenses', 'reports']::TEXT[],
    settings JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE CATEGORÍAS
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA DE PRODUCTOS Y SERVICIOS (Configurable para Físicos vs Servicios)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    barcode VARCHAR(50),
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    cost NUMERIC(12, 2) DEFAULT 0.00 CHECK (cost >= 0),
    stock NUMERIC(10, 2) DEFAULT 0,
    min_stock NUMERIC(10, 2) DEFAULT 5,
    unit_type VARCHAR(20) DEFAULT 'unidad',
    is_service BOOLEAN DEFAULT FALSE,
    duration_minutes INTEGER DEFAULT 30,
    commission_rate NUMERIC(5, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLA DE EMPLEADOS / ESPECIALISTAS / BARBEROS (Módulo Nivel 2)
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(50) DEFAULT 'barbero',
    phone VARCHAR(20),
    commission_pct NUMERIC(5, 2) DEFAULT 40.00 CHECK (commission_pct >= 0 AND commission_pct <= 100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLA DE CITAS Y AGENDA (Módulo Nivel 2 - Barbería / Spa)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(20),
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    service_id UUID REFERENCES products(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    commission_amount NUMERIC(12, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABLA DE VENTAS
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    payment_method VARCHAR(30) DEFAULT 'cash',
    status VARCHAR(20) DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. DETALLE DE VENTAS
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

-- 11. CUENTAS POR COBRAR (FIADOS)
CREATE TABLE IF NOT EXISTS receivables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    paid_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (paid_amount >= 0),
    status VARCHAR(20) DEFAULT 'pending',
    concept TEXT DEFAULT 'Fiado registrado en tienda',
    notes TEXT,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. GASTOS OPERATIVOS
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'otros',
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(30) DEFAULT 'cash',
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. MOVIMIENTOS DE INVENTARIO (KARDEX)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('sale', 'purchase', 'adjustment', 'initial')),
    quantity NUMERIC(10, 2) NOT NULL,
    previous_stock NUMERIC(10, 2) NOT NULL,
    new_stock NUMERIC(10, 2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA RENDIMIENTO EN CONSULTAS MULTI-TENANT
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_businesses_user ON businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business_active ON products(business_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_staff_business ON staff(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_business_date ON sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON expenses(business_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_receivables_business ON receivables(business_id);
CREATE INDEX IF NOT EXISTS idx_receivables_customer ON receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);

-- =====================================================
-- MIGRACIÓN DINÁMICA AUTOMÁTICA
-- (Seguro para ejecutar múltiples veces sin perder datos)
-- =====================================================
DO $$
BEGIN
    -- Módulo de negocios: enabled_modules y settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'enabled_modules') THEN
        ALTER TABLE businesses ADD COLUMN enabled_modules TEXT[] DEFAULT ARRAY['pos', 'inventory', 'expenses', 'reports']::TEXT[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'settings') THEN
        ALTER TABLE businesses ADD COLUMN settings JSONB DEFAULT '{}'::JSONB;
    END IF;

    -- Actualizar módulos predeterminados según el business_type_id para negocios existentes
    UPDATE businesses b
    SET enabled_modules = bt.default_modules
    FROM business_types bt
    WHERE b.business_type_id = bt.id AND (b.enabled_modules IS NULL OR b.enabled_modules = '{}');

    -- Columnas de servicios en products
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'duration_minutes') THEN
        ALTER TABLE products ADD COLUMN duration_minutes INTEGER DEFAULT 30;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'commission_rate') THEN
        ALTER TABLE products ADD COLUMN commission_rate NUMERIC(5, 2) DEFAULT 0.00;
    END IF;

    -- Columna staff_id en sale_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'staff_id') THEN
        ALTER TABLE sale_items ADD COLUMN staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
    END IF;

    -- Columnas en receivables
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receivables' AND column_name = 'concept') THEN
        ALTER TABLE receivables ADD COLUMN concept TEXT DEFAULT 'Fiado registrado en tienda';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receivables' AND column_name = 'notes') THEN
        ALTER TABLE receivables ADD COLUMN notes TEXT;
    END IF;
END $$;
