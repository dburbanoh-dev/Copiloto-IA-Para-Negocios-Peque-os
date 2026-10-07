import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const Navbar = ({ activeTab, setActiveTab }) => {
  const { user, business, logout } = useContext(AuthContext);

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
              <li>
                <button
                  className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('dashboard')}
                >
                  📊 Inicio
                </button>
              </li>
              <li>
                <button
                  className={`nav-btn ${activeTab === 'copilot' ? 'active' : ''}`}
                  onClick={() => setActiveTab('copilot')}
                >
                  🤖 Copiloto IA
                </button>
              </li>
              <li>
                <button
                  className={`nav-btn ${activeTab === 'sales' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sales')}
                >
                  🛒 Ventas
                </button>
              </li>
              <li>
                <button
                  className={`nav-btn ${activeTab === 'products' ? 'active' : ''}`}
                  onClick={() => setActiveTab('products')}
                >
                  📦 Catálogo
                </button>
              </li>
              <li>
                <button
                  className={`nav-btn ${activeTab === 'receivables' ? 'active' : ''}`}
                  onClick={() => setActiveTab('receivables')}
                >
                  📑 Fiados
                </button>
              </li>
            </ul>
          )}

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                🏬 {business ? business.name : user.full_name}
              </span>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }} onClick={logout}>
                Salir
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Navegación Inferior en Móviles */}
      {user && (
        <nav className="mobile-nav">
          <button
            className={`mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="icon">📊</span>
            <span>Inicio</span>
          </button>
          <button
            className={`mobile-nav-item ${activeTab === 'copilot' ? 'active' : ''}`}
            onClick={() => setActiveTab('copilot')}
          >
            <span className="icon">🤖</span>
            <span>Copiloto</span>
          </button>
          <button
            className={`mobile-nav-item ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            <span className="icon">🛒</span>
            <span>Ventas</span>
          </button>
          <button
            className={`mobile-nav-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <span className="icon">📦</span>
            <span>Stock</span>
          </button>
          <button
            className={`mobile-nav-item ${activeTab === 'receivables' ? 'active' : ''}`}
            onClick={() => setActiveTab('receivables')}
          >
            <span className="icon">📑</span>
            <span>Fiados</span>
          </button>
        </nav>
      )}
    </>
  );
};
