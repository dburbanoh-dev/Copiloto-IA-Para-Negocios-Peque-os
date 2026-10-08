import React, { useState, useEffect } from 'react';
import { fetchApi } from '../api/client';

export const StaffView = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    role: 'barbero',
    phone: '',
    commission_pct: '45'
  });

  const loadStaff = async () => {
    try {
      setLoading(true);
      const data = await fetchApi('/staff');
      setStaff(data);
    } catch (err) {
      console.error('Error al cargar equipo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await fetchApi('/staff', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      alert('¡Especialista registrado exitosamente!');
      setShowModal(false);
      setFormData({ name: '', role: 'barbero', phone: '', commission_pct: '45' });
      loadStaff();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de eliminar a "${name}" del equipo?`)) return;
    try {
      await fetchApi(`/staff/${id}`, { method: 'DELETE' });
      loadStaff();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>💈 Equipo de Trabajo & Comisiones</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Gestiona los barberos, estilistas o colaboradores y el porcentaje de comisión que gana cada uno
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Nuevo Barbero / Especialista
        </button>
      </div>

      {/* Tabla de Personal */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol / Especialidad</th>
              <th>Teléfono</th>
              <th>% Comisión Acordada</th>
              <th>Servicios Atendidos</th>
              <th>Total Comisiones Ganadas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>Cargando equipo...</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay especialistas registrados en este momento.</td></tr>
            ) : (
              staff.map(member => (
                <tr key={member.id}>
                  <td style={{ fontWeight: '600', color: '#f8fafc' }}>
                    💈 {member.name}
                  </td>
                  <td>
                    <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>
                      {member.role}
                    </span>
                  </td>
                  <td>{member.phone || 'Sin registrar'}</td>
                  <td style={{ fontWeight: '700', color: '#38bdf8' }}>
                    {Number(member.commission_pct)}%
                  </td>
                  <td>{member.completed_appointments || 0} cortes/servicios</td>
                  <td style={{ fontWeight: '700', color: '#fbbf24' }}>
                    ${Number(member.total_commissions_earned || 0).toLocaleString('es-CO')} COP
                  </td>
                  <td>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#991b1b', border: 'none' }}
                      onClick={() => handleDelete(member.id, member.name)}
                    >
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Especialista */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%' }}>
            <h3>💈 Registrar Miembro del Equipo</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Define el especialista y el porcentaje de comisión que recibirá por cada servicio
            </p>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nombre Completo</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Andrés Barber"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Rol</label>
                  <select
                    className="select-field"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="barbero">Barbero</option>
                    <option value="estilista">Estilista</option>
                    <option value="manicurista">Manicurista</option>
                    <option value="auxiliar">Auxiliar / Empleado</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>% Comisión</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input-field"
                    placeholder="45"
                    value={formData.commission_pct}
                    onChange={(e) => setFormData({ ...formData, commission_pct: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Teléfono / WhatsApp</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. 315 987 6543"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
