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
    lowStockCount: 0,
    appointmentsToday: 0,
    commissionsToday: 0
  });

  const [loading, setLoading] = useState(true);

  const enabledModules = business?.enabled_modules || ['pos', 'inventory', 'expenses', 'reports'];
  const isBarber = business?.business_type_id === 'barberia';

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const promises = [
          fetchApi('/sales'),
          fetchApi('/expenses')
        ];

        if (enabledModules.includes('receivables')) {
          promises.push(fetchApi('/receivables'));
        } else {
          promises.push(Promise.resolve({ summary: { total_pending_amount: 0 } }));
        }

        if (enabledModules.includes('inventory')) {
          promises.push(fetchApi('/products?active_only=true'));
        } else {
          promises.push(Promise.resolve([]));
        }

        if (enabledModules.includes('appointments')) {
          const todayDate = new Date().toISOString().split('T')[0];
          promises.push(fetchApi(`/appointments?date=${todayDate}`));
        } else {
          promises.push(Promise.resolve({ summary: { total_today: 0, commissions_today: 0 } }));
        }

        const [salesRes, expensesRes, receivablesRes, productsRes, apptRes] = await Promise.all(promises);

        const isToday = (dateStr) => {
          if (!dateStr) return false;
          const d = new Date(dateStr);
          const now = new Date();
          return d.getFullYear() === now.getFullYear() &&
                 d.getMonth() === now.getMonth() &&
                 d.getDate() === now.getDate();
        };

        // Ventas de hoy (en zona horaria local)
        const salesToday = (salesRes || [])
          .filter(s => s.status !== 'cancelled' && isToday(s.created_at))
          .reduce((acc, s) => acc + Number(s.total_amount), 0);

        // Gastos de hoy (en zona horaria local)
        const expensesToday = (expensesRes || [])
          .filter(e => isToday(e.date || e.created_at))
          .reduce((acc, e) => acc + Number(e.amount), 0);

        // Deudas por cobrar
        const receivablesPending = Number(receivablesRes?.summary?.total_pending_amount || 0);

        // Stock bajo
        const lowStockCount = (productsRes || []).filter(p => !p.is_service && Number(p.stock) <= Number(p.min_stock)).length;

        // Citas y comisiones
        const appointmentsToday = Number(apptRes?.summary?.total_today || 0);
        const commissionsToday = Number(apptRes?.summary?.commissions_today || 0);

        setMetrics({
          salesToday,
          expensesToday,
          receivablesPending,
          lowStockCount,
          appointmentsToday,
          commissionsToday
        });
      } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [business]);

  const profitEstimated = metrics.salesToday - metrics.expensesToday;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Resumen del Negocio</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {business ? `${business.name} — Perfil: ${(business.business_type_id || 'comercio').toUpperCase()}` : 'Mi Negocio'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {enabledModules.includes('appointments') && (
            <button className="btn btn-primary" onClick={() => setActiveTab('appointments')}>+ Agendar Cita</button>
          )}
          {enabledModules.includes('pos') && (
            <button className="btn btn-primary" onClick={() => setActiveTab('sales')}>
              {isBarber ? '+ Cobro en Caja' : '+ Nueva Venta'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setActiveTab('products')}>
            {isBarber ? '+ Servicios' : '+ Catálogo'}
          </button>
          <button className="btn btn-secondary" onClick={() => setActiveTab('settings')}>⚙️ Configuración</button>
        </div>
      </div>

      {/* Tarjetas de Métricas Principales Dinámicas */}
      <div className="card-grid">
        {/* Métricas para Barberías y Servicios */}
        {enabledModules.includes('appointments') && (
          <div className="card metric-card">
            <div className="metric-info">
              <p>Citas de Hoy</p>
              <h3>{metrics.appointmentsToday} turnos</h3>
            </div>
            <div className="metric-icon icon-stock">📅</div>
          </div>
        )}

        {enabledModules.includes('pos') && (
          <div className="card metric-card">
            <div className="metric-info">
              <p>{isBarber ? 'Ingresos de Hoy' : 'Ventas de Hoy'}</p>
              <h3>${metrics.salesToday.toLocaleString('es-CO')}</h3>
            </div>
            <div className="metric-icon icon-sales">🛒</div>
          </div>
        )}

        {enabledModules.includes('appointments') && (
          <div className="card metric-card">
            <div className="metric-info">
              <p>Comisiones a Pagar</p>
              <h3 style={{ color: '#fbbf24' }}>${metrics.commissionsToday.toLocaleString('es-CO')}</h3>
            </div>
            <div className="metric-icon icon-receivables">💈</div>
          </div>
        )}

        {enabledModules.includes('expenses') && (
          <div className="card metric-card">
            <div className="metric-info">
              <p>Gastos de Hoy</p>
              <h3>${metrics.expensesToday.toLocaleString('es-CO')}</h3>
            </div>
            <div className="metric-icon icon-expenses">💸</div>
          </div>
        )}

        {enabledModules.includes('pos') && (
          <div className="card metric-card">
            <div className="metric-info">
              <p>Balance Estimado</p>
              <h3 style={{ color: profitEstimated >= 0 ? '#34d399' : '#f87171' }}>
                ${profitEstimated.toLocaleString('es-CO')}
              </h3>
            </div>
            <div className="metric-icon icon-sales">📈</div>
          </div>
        )}

        {/* Métrica de Fiados (solo si está habilitado) */}
        {enabledModules.includes('receivables') && (
          <div className="card metric-card">
            <div className="metric-info">
              <p>Por Cobrar (Fiados)</p>
              <h3>${metrics.receivablesPending.toLocaleString('es-CO')}</h3>
            </div>
            <div className="metric-icon icon-receivables">💰</div>
          </div>
        )}

        {/* Métrica de Inventario Físico (solo si está habilitado) */}
        {enabledModules.includes('inventory') && (
          <div className="card metric-card">
            <div className="metric-info">
              <p>Stock Bajo</p>
              <h3>{metrics.lowStockCount} items</h3>
            </div>
            <div className="metric-icon icon-stock">📦</div>
          </div>
        )}
      </div>

      {/* Widget Principal del Copiloto IA */}
      <CopilotChat />
    </div>
  );
};
