import React, { useState, useEffect, useContext } from 'react';
import { fetchApi } from '../api/client';
import { AuthContext } from '../context/AuthContext';
import { CopilotChat } from './CopilotChat';

export const Dashboard = ({ setActiveTab }) => {
  const { business } = useContext(AuthContext);
  const [metrics, setMetrics] = useState({
    salesToday: 0,
    expensesToday: 0,
    receivablesPending: 0,
    lowStockCount: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [salesRes, expensesRes, receivablesRes, productsRes] = await Promise.all([
          fetchApi('/sales'),
          fetchApi('/expenses'),
          fetchApi('/receivables'),
          fetchApi('/products?active_only=true')
        ]);

        const todayStr = new Date().toISOString().split('T')[0];

        // Ventas de hoy
        const salesToday = salesRes
          .filter(s => s.status !== 'cancelled' && s.created_at.startsWith(todayStr))
          .reduce((acc, s) => acc + Number(s.total_amount), 0);

        // Gastos de hoy
        const expensesToday = expensesRes
          .filter(e => e.date && e.date.startsWith(todayStr))
          .reduce((acc, e) => acc + Number(e.amount), 0);

        // Deudas por cobrar
        const receivablesPending = Number(receivablesRes.summary?.total_pending_amount || 0);

        // Stock bajo
        const lowStockCount = productsRes.filter(p => !p.is_service && Number(p.stock) <= Number(p.min_stock)).length;

        setMetrics({
          salesToday,
          expensesToday,
          receivablesPending,
          lowStockCount
        });
      } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const profitEstimated = metrics.salesToday - metrics.expensesToday;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Resumen del Negocio</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {business ? `${business.name} (${business.business_type_id.toUpperCase()})` : 'Mi Negocio'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={() => setActiveTab('sales')}>+ Nueva Venta</button>
          <button className="btn btn-secondary" onClick={() => setActiveTab('products')}>+ Catálogo</button>
        </div>
      </div>

      {/* Tarjetas de Métricas Principales */}
      <div className="card-grid">
        <div className="card metric-card">
          <div className="metric-info">
            <p>Ventas de Hoy</p>
            <h3>${metrics.salesToday.toLocaleString('es-CO')}</h3>
          </div>
          <div className="metric-icon icon-sales">🛒</div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <p>Gastos de Hoy</p>
            <h3>${metrics.expensesToday.toLocaleString('es-CO')}</h3>
          </div>
          <div className="metric-icon icon-expenses">💸</div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <p>Resultado Estimado</p>
            <h3 style={{ color: profitEstimated >= 0 ? '#34d399' : '#f87171' }}>
              ${profitEstimated.toLocaleString('es-CO')}
            </h3>
          </div>
          <div className="metric-icon icon-sales">📈</div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <p>Por Cobrar (Fiados)</p>
            <h3>${metrics.receivablesPending.toLocaleString('es-CO')}</h3>
          </div>
          <div className="metric-icon icon-receivables">💰</div>
        </div>

        <div className="card metric-card">
          <div className="metric-info">
            <p>Stock Bajo</p>
            <h3>{metrics.lowStockCount} items</h3>
          </div>
          <div className="metric-icon icon-stock">📦</div>
        </div>
      </div>

      {/* Widget Principal del Copiloto IA */}
      <CopilotChat />
    </div>
  );
};
