import React, { useState, useContext } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthView } from './components/AuthView';
import { Dashboard } from './components/Dashboard';
import { CopilotChat } from './components/CopilotChat';
import { SalesView } from './components/SalesView';
import { ProductsView } from './components/ProductsView';
import { ReceivablesView } from './components/ReceivablesView';

const MainApp = () => {
  const { user, loading } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        🤖 Cargando NegocioAI...
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {!user ? (
          <AuthView />
        ) : (
          <>
            {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
            {activeTab === 'copilot' && <CopilotChat />}
            {activeTab === 'sales' && <SalesView />}
            {activeTab === 'products' && <ProductsView />}
            {activeTab === 'receivables' && <ReceivablesView />}
          </>
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
