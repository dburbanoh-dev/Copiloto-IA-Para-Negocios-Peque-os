import React, { useState, useEffect } from 'react';
import { fetchApi } from '../api/client';

export const AppointmentsView = () => {
  const [appointments, setAppointments] = useState([]);
  const [summary, setSummary] = useState({});
  const [staffList, setStaffList] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal nueva cita
  const [showModal, setShowModal] = useState(false);
  const [newAppt, setNewAppt] = useState({
    customer_name: '',
    customer_phone: '',
    staff_id: '',
    service_id: '',
    scheduled_at: `${new Date().toISOString().split('T')[0]}T10:00`,
    notes: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      let query = `/appointments?date=${selectedDate}`;
      if (statusFilter !== 'all') query += `&status=${statusFilter}`;

      const [apptRes, staffRes, prodRes] = await Promise.all([
        fetchApi(query),
        fetchApi('/staff'),
        fetchApi('/products?is_service=true')
      ]);

      setAppointments(apptRes.appointments || []);
      setSummary(apptRes.summary || {});
      setStaffList(staffRes || []);
      setServicesList(prodRes || []);

      if (staffRes.length > 0 && !newAppt.staff_id) {
        setNewAppt(prev => ({ ...prev, staff_id: staffRes[0].id }));
      }
      if (prodRes.length > 0 && !newAppt.service_id) {
        setNewAppt(prev => ({ ...prev, service_id: prodRes[0].id }));
      }
    } catch (err) {
      console.error('Error al cargar agenda:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, statusFilter]);

  const handleCreateAppointment = async (e) => {
    e.preventDefault();
    try {
      await fetchApi('/appointments', {
        method: 'POST',
        body: JSON.stringify(newAppt)
      });
      alert('¡Cita agendada exitosamente!');
      setShowModal(false);
      setNewAppt(prev => ({ ...prev, customer_name: '', customer_phone: '', notes: '' }));
      loadData();
    } catch (err) {
      alert(`Error al agendar: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const res = await fetchApi(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      alert(res.message);
      loadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id, clientName) => {
    if (!window.confirm(`¿Estás seguro de eliminar la cita de "${clientName}"?`)) return;
    try {
      await fetchApi(`/appointments/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>📅 Agenda de Citas & Servicios</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Gestiona los turnos de tus clientes, barberos asignados y comisiones
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Agendar Nueva Cita
        </button>
      </div>

      {/* Tarjetas de Resumen del Día */}
      <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card metric-card">
          <div className="metric-info">
            <p>Citas de Hoy</p>
            <h3>{summary.total_today || 0}</h3>
          </div>
          <div className="metric-icon icon-sales">📅</div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <p>Completadas / Atendidas</p>
            <h3 style={{ color: '#34d399' }}>{summary.completed_today || 0}</h3>
          </div>
          <div className="metric-icon icon-stock">✂️</div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <p>Ingresos por Servicios</p>
            <h3 style={{ color: '#38bdf8' }}>${Number(summary.income_today || 0).toLocaleString('es-CO')}</h3>
          </div>
          <div className="metric-icon icon-expenses">💵</div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <p>Comisiones a Barberos</p>
            <h3 style={{ color: '#fbbf24' }}>${Number(summary.commissions_today || 0).toLocaleString('es-CO')}</h3>
          </div>
          <div className="metric-icon icon-receivables">💈</div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Fecha de Agenda</label>
          <input
            type="date"
            className="input-field"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Estado</label>
          <select className="select-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todas las citas</option>
            <option value="scheduled">Pendientes / Agendadas</option>
            <option value="completed">Completadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>
      </div>

      {/* Tabla de Citas */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Cliente</th>
              <th>Servicio</th>
              <th>Especialista / Barbero</th>
              <th>Precio</th>
              <th>Comisión</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ textAlign: 'center' }}>Cargando agenda...</td></tr>
            ) : appointments.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay citas agendadas para esta fecha.</td></tr>
            ) : (
              appointments.map(a => {
                const dateObj = new Date(a.scheduled_at);
                const timeStr = dateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

                return (
                  <tr key={a.id}>
                    <td style={{ fontWeight: '700', color: '#38bdf8' }}>⏰ {timeStr}</td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{a.customer_name}</div>
                      {a.customer_phone && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>📞 {a.customer_phone}</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: '500' }}>✂️ {a.service_name || 'Servicio'}</div>
                      {a.duration_minutes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>⏱️ {a.duration_minutes} min</div>}
                      {a.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{a.notes}"</div>}
                    </td>
                    <td>💈 {a.staff_name || 'Sin asignar'}</td>
                    <td style={{ fontWeight: '600' }}>${Number(a.total_price).toLocaleString('es-CO')}</td>
                    <td style={{ color: '#fbbf24' }}>${Number(a.commission_amount).toLocaleString('es-CO')}</td>
                    <td>
                      <span className={`badge ${
                        a.status === 'completed' ? 'badge-success' : 
                        a.status === 'in_progress' ? 'badge-warning' : 
                        a.status === 'cancelled' ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {a.status === 'completed' ? '🟢 Atendido' : 
                         a.status === 'in_progress' ? '🟡 En Silla' : 
                         a.status === 'cancelled' ? '🔴 Cancelada' : '⏳ Agendada'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {a.status === 'scheduled' && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            title="Marcar como atendido y registrar venta en caja"
                            onClick={() => handleUpdateStatus(a.id, 'completed')}
                          >
                            ✅ Cobrar
                          </button>
                        )}
                        {a.status !== 'cancelled' && a.status !== 'completed' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => handleUpdateStatus(a.id, 'cancelled')}
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#991b1b', border: 'none' }}
                          onClick={() => handleDelete(a.id, a.customer_name)}
                        >
                          🗑️
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

      {/* Modal Agendar Cita */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%' }}>
            <h3>✂️ Agendar Nueva Cita</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Registra el cliente, servicio requerido y el especialista que lo atenderá
            </p>

            <form onSubmit={handleCreateAppointment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nombre del Cliente</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Juan Pérez"
                  value={newAppt.customer_name}
                  onChange={(e) => setNewAppt({ ...newAppt, customer_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Teléfono / WhatsApp</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. 310 123 4567"
                  value={newAppt.customer_phone}
                  onChange={(e) => setNewAppt({ ...newAppt, customer_phone: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Servicio a Realizar</label>
                  <select
                    className="select-field"
                    value={newAppt.service_id}
                    onChange={(e) => setNewAppt({ ...newAppt, service_id: e.target.value })}
                  >
                    {servicesList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} - ${Number(s.price).toLocaleString('es-CO')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Barbero / Especialista</label>
                  <select
                    className="select-field"
                    value={newAppt.staff_id}
                    onChange={(e) => setNewAppt({ ...newAppt, staff_id: e.target.value })}
                  >
                    {staffList.map(st => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.commission_pct}% comisión)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fecha y Hora de Atención</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={newAppt.scheduled_at}
                  onChange={(e) => setNewAppt({ ...newAppt, scheduled_at: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Notas o Preferencias</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Pide degradado con navaja y barba marcada..."
                  value={newAppt.notes}
                  onChange={(e) => setNewAppt({ ...newAppt, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cita</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
