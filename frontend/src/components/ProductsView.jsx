import React, { useState, useEffect } from 'react';
import { fetchApi } from '../api/client';

export const ProductsView = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    cost: '',
    stock: '10',
    min_stock: '5',
    unit_type: 'unidad',
    is_service: false,
    duration_minutes: '30',
    commission_rate: '40'
  });

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await fetchApi('/products');
      setProducts(data);
    } catch (error) {
      console.error('Error al cargar catálogo:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await fetchApi('/products', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      setFormData({
        name: '',
        price: '',
        cost: '',
        stock: '10',
        min_stock: '5',
        unit_type: 'unidad',
        is_service: false,
        duration_minutes: '30',
        commission_rate: '40'
      });
      loadProducts();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (filterType === 'service') return matchSearch && p.is_service;
    if (filterType === 'product') return matchSearch && !p.is_service;
    if (filterType === 'low_stock') return matchSearch && !p.is_service && Number(p.stock) <= Number(p.min_stock);
    return matchSearch;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>📦 Catálogo de Productos & Servicios</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Gestiona los productos físicos de inventario y los servicios ofrecidos por tu equipo
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Nuevo Producto / Servicio
        </button>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="input-field"
          style={{ flex: 1, minWidth: '200px' }}
          placeholder="🔍 Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select-field" style={{ width: 'auto' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">Todos los elementos</option>
          <option value="product">📦 Solo Productos Físicos</option>
          <option value="service">✂️ Solo Servicios (Cortes/Estética/Copias)</option>
          <option value="low_stock">🟡 Solo Stock Bajo</option>
        </select>
      </div>

      {/* Tabla de Productos y Servicios */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Precio Venta</th>
              <th>Costo / Comisión</th>
              <th>Stock / Duración</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center' }}>Cargando catálogo...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron elementos en el catálogo.</td></tr>
            ) : (
              filtered.map((item) => {
                const isService = item.is_service;
                const stockNum = Number(item.stock);
                const minStockNum = Number(item.min_stock);

                let badgeClass = 'badge-success';
                let statusLabel = '🟢 Normal';

                if (isService) {
                  badgeClass = 'badge-info';
                  statusLabel = '🔵 Servicio Activo';
                } else if (stockNum <= 0) {
                  badgeClass = 'badge-danger';
                  statusLabel = '🔴 Sin Stock';
                } else if (stockNum <= minStockNum) {
                  badgeClass = 'badge-warning';
                  statusLabel = '🟡 Stock Bajo';
                }

                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: '600' }}>
                      {isService ? '✂️' : '📦'} {item.name}
                    </td>
                    <td>{isService ? 'Servicio' : 'Producto Físico'}</td>
                    <td style={{ fontWeight: '700', color: '#34d399' }}>${Number(item.price).toLocaleString('es-CO')}</td>
                    <td>
                      {isService 
                        ? `${Number(item.commission_rate || 40)}% comisión` 
                        : `$${Number(item.cost || 0).toLocaleString('es-CO')}`}
                    </td>
                    <td>
                      {isService 
                        ? `⏱️ ${item.duration_minutes || 30} min` 
                        : `${stockNum} ${item.unit_type}`}
                    </td>
                    <td><span className={`badge ${badgeClass}`}>{statusLabel}</span></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo Producto / Servicio Adaptativo */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%' }}>
            <h3>+ Crear Nuevo Elemento</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>¿Qué tipo de elemento deseas agregar?</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="radio" checked={!formData.is_service} onChange={() => setFormData({ ...formData, is_service: false })} />
                    📦 Producto Físico (Inventario)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <input type="radio" checked={formData.is_service} onChange={() => setFormData({ ...formData, is_service: true })} />
                    ✂️ Servicio (Corte, Barba, Copias)
                  </label>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {formData.is_service ? 'Nombre del Servicio' : 'Nombre del Producto'}
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={formData.is_service ? 'Ej. Corte Degradado con Navaja' : 'Ej. Cera Capilar Mate 100g o Arroz 1kg'}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Precio al Público ($)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    placeholder="20000"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>

                {formData.is_service ? (
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Duración Estimada (Minutos)</label>
                    <input
                      type="number"
                      min="5"
                      className="input-field"
                      placeholder="35"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Costo de Compra ($)</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      placeholder="12000"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Campos específicos para Productos Físicos */}
              {!formData.is_service && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stock Inicial</label>
                    <input
                      type="number"
                      min="0"
                      className="input-field"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stock Mínimo para Alerta</label>
                    <input
                      type="number"
                      min="1"
                      className="input-field"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* Campos específicos para Servicios */}
              {formData.is_service && (
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>% Comisión por Defecto para el Barbero/Especialista</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input-field"
                    placeholder="40"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  {formData.is_service ? 'Guardar Servicio' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
