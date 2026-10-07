import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const AuthView = () => {
  const { login, register } = useContext(AuthContext);
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    business_name: '',
    business_type_id: 'tienda',
    city: 'Medellín',
    phone: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register(formData);
      } else {
        await login(formData.email, formData.password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '3rem auto 0 auto' }} className="card">
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🤖</div>
        <h2>{isRegister ? 'Crear Cuenta en NegocioAI' : 'Iniciar Sesión'}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          {isRegister ? 'Administra tu negocio hablando con él' : 'Ingresa a tu copiloto inteligente'}
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--color-danger)', color: '#f87171', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isRegister && (
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Nombre Completo del Propietario</label>
            <input type="text" name="full_name" className="input-field" placeholder="Ej. Don Pedro Pérez" value={formData.full_name} onChange={handleChange} required />
          </div>
        )}

        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Correo Electrónico</label>
          <input type="email" name="email" className="input-field" placeholder="ejemplo@negocio.com" value={formData.email} onChange={handleChange} required />
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Contraseña</label>
          <input type="password" name="password" className="input-field" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
        </div>

        {isRegister && (
          <>
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Nombre del Negocio</label>
              <input type="text" name="business_name" className="input-field" placeholder="Ej. Abarrotes Don Pedro" value={formData.business_name} onChange={handleChange} required />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>¿Qué tipo de negocio tienes?</label>
              <select name="business_type_id" className="select-field" value={formData.business_type_id} onChange={handleChange}>
                <option value="tienda">Tienda de Barrio / Minimercado</option>
                <option value="barberia">Barbería / Peluquería</option>
                <option value="papeleria">Papelería / Variedades</option>
                <option value="bar">Bar / Licorera</option>
                <option value="restaurante">Restaurante / Comidas Rápidas</option>
                <option value="emprendimiento">Emprendimiento / Tienda Virtual</option>
                <option value="otro">Otro Pequeño Comercio</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Ciudad</label>
              <input type="text" name="city" className="input-field" placeholder="Ej. Medellín, Bogotá, Cali..." value={formData.city} onChange={handleChange} />
            </div>
          </>
        )}

        <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }} disabled={loading}>
          {loading ? 'Procesando...' : (isRegister ? 'Registrar Negocio' : 'Ingresar')}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
        {isRegister ? '¿Ya tienes una cuenta?' : '¿Aún no tienes un negocio registrado?'}
        <button
          onClick={() => { setIsRegister(!isRegister); setError(''); }}
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: '700', marginLeft: '0.5rem' }}
        >
          {isRegister ? 'Iniciar Sesión' : 'Crear Cuenta'}
        </button>
      </div>
    </div>
  );
};
