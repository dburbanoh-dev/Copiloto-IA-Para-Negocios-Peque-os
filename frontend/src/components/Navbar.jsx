import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const Navbar = ({ activeTab, setActiveTab }) => {
  const { user, business, logout } = useContext(AuthContext);

  const enabledModules = business?.enabled_modules || ['pos', 'inventory', 'expenses', 'reports'];
  const isBarber = business?.business_type_id === 'barberia';

  // Lista dinámica de navegación según los módulos encendidos por el negocio
  const dynamicNavItems = [
    {
      id: 'dashboard',
      label: '📊 Inicio',
      visible: true
    },
    {
      id: 'copilot',
      label: '🤖 Copiloto IA',
      visible: true
    },
    {
      id: 'appointments',
      label: '📅 Agenda & Citas',
      visible: enabledModules.includes('appointments')
    },
    {
      id: 'sales',
      label: isBarber ? '💈 Cobro & Caja' : '🛒 Ventas POS',
      visible: enabledModules.includes('pos')
    },
    {
      id: 'products',
      label: isBarber ? '✂️ Servicios & Catálogo' : '📦 Catálogo & Stock',
      visible: enabledModules.includes('inventory') || enabledModules.includes('services')
    },
    {
      id: 'staff',
      label: isBarber ? '💈 Barberos & Comisiones' : '👥 Personal',
      visible: enabledModules.includes('staff')
    },
    {
      id: 'receivables',
      label: '📑 Fiados',
      visible: enabledModules.includes('receivables')
    },
    {
      id: 'settings',
      label: '⚙️ Configuración',
      visible: true
    }
  ].filter(item => item.visible);

  return (
    <>
      <header className="navbar">
        <div className="nav-content">
          <a href="#" className="brand" onClick={() => setActiveTab('dashboard')}>
            <div className="brand-icon">🤖</div>
            <span>NegocioAI</span>
          </a>

          {user && (
            <ul className="nav-links">
              {dynamicNavItems.map(item => (
                <li key={item.id}>
                  <button
                    className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: '600', color: '#f8fafc' }}>
                  {business ? business.name : user.full_name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-primary-light)', textTransform: 'capitalize' }}>
                  {business?.business_type_id || 'Comercio'}
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
                onClick={logout}
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Navegación Inferior en Móviles Dinámica */}
      {user && (
        <nav className="mobile-nav">
          {dynamicNavItems.slice(0, 5).map(item => (
            <button
              key={item.id}
              className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="icon">{item.label.split(' ')[0]}</span>
              <span>{item.label.split(' ')[1] || item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </>
  );
};
