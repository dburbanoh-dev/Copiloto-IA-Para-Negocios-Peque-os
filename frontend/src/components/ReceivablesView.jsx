import React, { useState, useEffect } from 'react';
import { fetchApi } from '../api/client';

export const ReceivablesView = () => {
  const [data, setData] = useState({ summary: {}, receivables: [] });
  const [loading, setLoading] = useState(true);

  // Modales
  const [showNewModal, setShowNewModal] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [abonoAmount, setAbonoAmount] = useState('');

  // Formulario de nuevo fiado
  const [newFiado, setNewFiado] = useState({
    customer_name: '',
    phone: '',
    concept: '',
    amount: '',
    due_date: '',
    notes: ''
  });

  const loadReceivables = async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/receivables');
      setData(res);
    } catch (error) {
      console.error('Error al cargar cuentas por cobrar:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceivables();
  }, []);

  // Crear nuevo fiado en las palabras del dueño
  const handleCreateFiado = async (e) => {
    e.preventDefault();
    try {
      await fetchApi('/receivables', {
        method: 'POST',
        body: JSON.stringify(newFiado)
      });
      alert('¡Fiado registrado exitosamente!');
      setShowNewModal(false);
      setNewFiado({ customer_name: '', phone: '', concept: '', amount: '', due_date: '', notes: '' });
      loadReceivables();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Registrar abono a deuda existente
  const handleRecordAbono = async (e) => {
    e.preventDefault();
    if (!payModal || !abonoAmount) return;

    try {
      const res = await fetchApi(`/receivables/${payModal.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(abonoAmount) })
      });
      alert(res.message);
      setPayModal(null);
      setAbonoAmount('');
      loadReceivables();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Eliminar registro de fiado saldado / pagado
  const handleDeleteFiado = async (id, customerName) => {
    if (!window.confirm(`¿Estás seguro de eliminar el registro de fiado de "${customerName}" para mantener tus cuentas limpias?`)) {
      return;
    }

    try {
      await fetchApi(`/receivables/${id}`, {
        method: 'DELETE'
      });
      alert(`Registro de "${customerName}" eliminado por completo.`);
      loadReceivables();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const totalPending = Number(data.summary?.total_pending_amount || 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Cuentas por Cobrar (Fiados)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Registra deudas, abonos y elimina registros saldados para evitar confusiones</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="card" style={{ padding: '0.5rem 1rem', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid var(--color-warning)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-warning)', fontWeight: '600' }}>TOTAL SALDO POR COBRAR</span>
            <h3 style={{ color: '#fbbf24', fontSize: '1.3rem' }}>${totalPending.toLocaleString('es-CO')}</h3>
          </div>

          <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            + Registrar Nuevo Fiado
          </button>
        </div>
      </div>

      {/* Tabla de Cuentas por Cobrar */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente / Vecino</th>
              <th>Lo que llevó (Concepto)</th>
              <th>Deuda Inicial</th>
              <th>Abonado</th>
              <th>Saldo Pendiente</th>
              <th>Compromiso Pago</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ textAlign: 'center' }}>Cargando fiados...</td></tr>
            ) : data.receivables.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay registros de fiados en este momento.</td></tr>
            ) : (
              data.receivables.map(r => {
                const total = Number(r.total_amount);
                const paid = Number(r.paid_amount);
                const pending = Math.max(0, total - paid);

                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{r.customer_name}</div>
                      {r.customer_phone && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>📞 {r.customer_phone}</div>}
                    </td>
                    <td style={{ maxWidth: '240px' }}>
                      <div style={{ color: '#f8fafc', fontWeight: '500' }}>📝 {r.concept || 'Fiado en tienda'}</div>
                      {r.notes && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{r.notes}"</div>}
                    </td>
                    <td>${total.toLocaleString('es-CO')}</td>
                    <td style={{ color: '#34d399' }}>${paid.toLocaleString('es-CO')}</td>
                    <td style={{ fontWeight: '700', color: pending > 0 ? '#fbbf24' : '#34d399' }}>
                      ${pending.toLocaleString('es-CO')}
                    </td>
                    <td>{r.due_date ? new Date(r.due_date).toLocaleDateString('es-CO') : 'Sin fecha fija'}</td>
                    <td>
                      <span className={`badge ${r.status === 'paid' ? 'badge-success' : r.status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                        {r.status === 'paid' ? '🟢 Pagado' : r.status === 'partial' ? '🟡 Abono Parcial' : '🔴 Pendiente'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {r.status !== 'paid' && (
                          <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }} onClick={() => setPayModal(r)}>
                            + Abono
                          </button>
                        )}
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', background: '#991b1b', border: 'none' }}
                          title="Eliminar registro para limpiar lista"
                          onClick={() => handleDeleteFiado(r.id, r.customer_name)}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal 1: Registrar Nuevo Fiado */}
      {showNewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%' }}>
            <h3>✍️ Registrar Nuevo Fiado / Deuda</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Escribe en tus propias palabras los detalles del fiado
            </p>

            <form onSubmit={handleCreateFiado} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nombre del Cliente / Vecino</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Don Carlos, Doña María, El vecino..."
                  value={newFiado.customer_name}
                  onChange={(e) => setNewFiado({ ...newFiado, customer_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Teléfono / WhatsApp (Opcional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. 310 123 4567"
                  value={newFiado.phone}
                  onChange={(e) => setNewFiado({ ...newFiado, phone: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>¿Qué llevó? (Describe en tus palabras)</label>
                <textarea
                  className="input-field"
                  rows="3"
                  placeholder="Ej. Llevó 2 pacas de Poker y 1 Aguardiente Nariño para la fiesta del fin de semana..."
                  value={newFiado.concept}
                  onChange={(e) => setNewFiado({ ...newFiado, concept: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Valor Total ($)</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    placeholder="Ej. 235000"
                    value={newFiado.amount}
                    onChange={(e) => setNewFiado({ ...newFiado, amount: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fecha Límite Pago</label>
                  <input
                    type="date"
                    className="input-field"
                    value={newFiado.due_date}
                    onChange={(e) => setNewFiado({ ...newFiado, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Notas o Recordatorio Adicional</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Prometió pagar el viernes de quincena..."
                  value={newFiado.notes}
                  onChange={(e) => setNewFiado({ ...newFiado, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Fiado</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Registrar Abono */}
      {payModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
            <h3>💰 Registrar Abono a {payModal.customer_name}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Saldo Pendiente Actual: <strong>${Math.max(0, Number(payModal.total_amount) - Number(payModal.paid_amount)).toLocaleString('es-CO')} COP</strong>
            </p>
            <form onSubmit={handleRecordAbono} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Monto del Abono ($)</label>
                <input type="number" min="1" className="input-field" placeholder="10000" value={abonoAmount} onChange={(e) => setAbonoAmount(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPayModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Abono</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
