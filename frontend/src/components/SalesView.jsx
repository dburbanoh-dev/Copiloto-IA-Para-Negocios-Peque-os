import React, { useState, useEffect } from 'react';
import { fetchApi } from '../api/client';

export const SalesView = () => {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [presentation, setPresentation] = useState('unit');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const loadData = async () => {
    try {
      setLoading(true);
      const [salesData, productsData] = await Promise.all([
        fetchApi('/sales'),
        fetchApi('/products?active_only=true')
      ]);
      setSales(salesData);
      setProducts(productsData);
      if (productsData.length > 0) {
        setSelectedProduct(productsData[0].id);
      }
    } catch (error) {
      console.error('Error al cargar ventas:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterSale = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const prodObj = products.find(p => p.id === selectedProduct);
    let finalQty = Number(quantity);
    let unitPrice = prodObj ? Number(prodObj.price) : 0;

    if (presentation === 'sixpack') {
      finalQty = Number(quantity) * 6;
      unitPrice = Math.round((unitPrice * 6 * 0.93) / 6);
    } else if (presentation === 'paca') {
      finalQty = Number(quantity) * 24;
      unitPrice = Math.round((unitPrice * 24 * 0.88) / 24);
    }

    try {
      await fetchApi('/sales', {
        method: 'POST',
        body: JSON.stringify({
          payment_method: paymentMethod,
          items: [
            {
              product_id: selectedProduct,
              quantity: finalQty,
              unit_price: unitPrice
            }
          ]
        })
      });

      alert(`¡Venta registrada exitosamente!`);
      setQuantity(1);
      setPresentation('unit');
      loadData();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleCancelSale = async (id) => {
    if (!window.confirm('¿Estás seguro de anular esta venta? Se devolverá el stock al inventario.')) return;

    try {
      await fetchApi(`/sales/${id}/cancel`, { method: 'PATCH' });
      alert('Venta anulada.');
      loadData();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const prodObj = products.find(p => p.id === selectedProduct);
  const basePrice = prodObj ? Number(prodObj.price) : 0;

  let multiplier = 1;
  let packDiscount = 1;
  if (presentation === 'sixpack') {
    multiplier = 6;
    packDiscount = 0.93;
  } else if (presentation === 'paca') {
    multiplier = 24;
    packDiscount = 0.88;
  }

  const calculatedTotal = Math.round(basePrice * multiplier * packDiscount * Number(quantity));

  return (
    <div>
      <h2>Ventas y Registro POS</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Registra ventas rápidas e inspecciona el historial detallado de lo vendido</p>

      {/* Formulario Rápido de Venta */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3>🛒 Registrar Nueva Venta Rápida</h3>
        <form onSubmit={handleRegisterSale} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem', alignItems: 'end' }}>
          
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Seleccionar Producto / Servicio</label>
            <select className="select-field" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} - ${Number(p.price).toLocaleString('es-CO')} {p.is_service ? '(Servicio)' : `(Stock: ${p.stock})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Presentación / Formato</label>
            <select className="select-field" value={presentation} onChange={(e) => setPresentation(e.target.value)}>
              <option value="unit">🍺 Unidad (1u)</option>
              <option value="sixpack">📦 Six-Pack (6u)</option>
              <option value="paca">🚚 Paca / Caja (24u)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Cantidad de {presentation === 'sixpack' ? 'Six-Packs' : presentation === 'paca' ? 'Pacas (24u)' : 'Unidades'}
            </label>
            <input type="number" min="1" className="input-field" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Método de Pago</label>
            <select className="select-field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia / Nequi</option>
              <option value="card">Tarjeta</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Calculado</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#34d399' }}>${calculatedTotal.toLocaleString('es-CO')}</div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ gridColumn: 'span 2' }}>Registrar Venta</button>
        </form>
      </div>

      {/* Historial de Ventas */}
      <h3>Historial de Ventas Recientes</h3>
      <div className="table-container" style={{ marginTop: '1rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Lo que se vendió</th>
              <th>Monto Total</th>
              <th>Método de Pago</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center' }}>Cargando ventas...</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay ventas registradas.</td></tr>
            ) : (
              sales.map(s => (
                <tr key={s.id}>
                  <td>{new Date(s.created_at).toLocaleString('es-CO')}</td>
                  <td style={{ fontWeight: '600', color: '#f8fafc' }}>
                    📦 {s.items_summary || 'Venta Registrada'}
                  </td>
                  <td style={{ fontWeight: '700', color: '#34d399' }}>${Number(s.total_amount).toLocaleString('es-CO')}</td>
                  <td>{s.payment_method === 'cash' ? 'Efectivo' : s.payment_method === 'transfer' ? 'Transferencia' : s.payment_method}</td>
                  <td>
                    <span className={`badge ${s.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>
                      {s.status === 'completed' ? '🟢 Completada' : '🔴 Anulada'}
                    </span>
                  </td>
                  <td>
                    {s.status === 'completed' && (
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleCancelSale(s.id)}>
                        Anular
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
