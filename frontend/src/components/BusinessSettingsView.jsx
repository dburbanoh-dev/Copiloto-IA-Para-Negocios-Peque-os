import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { fetchApi } from '../api/client';

export const BusinessSettingsView = () => {
  const { business, updateBusiness } = useContext(AuthContext);
  const [config, setConfig] = useState(null);
  const [availableModules, setAvailableModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState('COP');
  const [selectedModules, setSelectedModules] = useState([]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        const data = await fetchApi('/business/config');
        setConfig(data.business);
        setAvailableModules(data.available_modules || []);

        setName(data.business.name || '');
        setPhone(data.business.phone || '');
        setCity(data.business.city || '');
        setCurrency(data.business.currency || 'COP');
        setSelectedModules(data.business.enabled_modules || ['pos', 'inventory', 'expenses', 'reports']);
      } catch (err) {
        console.error('Error al cargar configuración:', err);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleToggleModule = (moduleId) => {
    setSelectedModules(prev => {
      if (prev.includes(moduleId)) {
        // No permitir deshabilitar todos
        if (prev.length <= 1) {
          alert('Debes mantener al menos un módulo habilitado.');
          return prev;
        }
        return prev.filter(m => m !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFeedback('');

      const res = await fetchApi('/business/config', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          phone,
          city,
          currency,
          enabled_modules: selectedModules
        })
      });

      // Actualizar el estado global del negocio en AuthContext
      updateBusiness(res.business);
      setFeedback('¡Configuración y módulos actualizados correctamente!');
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando configuración del negocio...</div>;
  }

  const typeName = config?.type_name || config?.business_type_id?.toUpperCase() || 'Comercio';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>⚙️ Configuración y Módulos del Negocio</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Personaliza tu empresa y activa o desactiva las herramientas que tu negocio realmente necesita.
        </p>
      </div>

      {feedback && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(52, 211, 153, 0.15)', border: '1px solid #34d399', borderRadius: '8px', color: '#34d399', marginBottom: '1.5rem', fontWeight: '500' }}>
          ✅ {feedback}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Tarjeta 1: Perfil de Empresa */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>🏢 Perfil de la Empresa</h3>
            <span className="badge badge-success" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>
              Perfil Activo: {typeName}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nombre Comercial del Negocio</label>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Teléfono / WhatsApp</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. 310 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ciudad / Municipio</label>
              <input
                type="text"
                className="input-field"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Moneda Operativa</label>
              <select className="select-field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="COP">COP ($ Peso Colombiano)</option>
                <option value="USD">USD ($ Dólar)</option>
                <option value="EUR">EUR (€ Euro)</option>
                <option value="MXN">MXN ($ Peso Mexicano)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tarjeta 2: Módulos Disponibles y Activables (Modular SaaS) */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem' }}>🧩 Módulos & Herramientas Activas</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Enciende los módulos que tu negocio utiliza. Las opciones no seleccionadas se ocultarán automáticamente de tu menú lateral.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {availableModules.map(mod => {
              const isActive = selectedModules.includes(mod.id);
              return (
                <div
                  key={mod.id}
                  onClick={() => handleToggleModule(mod.id)}
                  style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    border: `1px solid ${isActive ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.1)'}`,
                    background: isActive ? 'rgba(79, 70, 229, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => {}} // handled by parent onClick
                    style={{ marginTop: '0.25rem', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                  />
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem', color: isActive ? '#fff' : 'var(--text-muted)' }}>
                      {mod.icon} {mod.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: '1.3' }}>
                      {mod.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Botón de Guardar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}>
            {saving ? 'Guardando cambios...' : '💾 Guardar Configuración'}
          </button>
        </div>
      </form>
    </div>
  );
};
