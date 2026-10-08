const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const fetchApi = async (endpoint, options = {}) => {
  const token = localStorage.getItem('negocioai_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { error: text || 'Respuesta no válida del servidor' };
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Si el token es inválido o expiró, avisar o limpiar
        if (token && (data.error?.includes('expirado') || data.error?.includes('inválido'))) {
          localStorage.removeItem('negocioai_token');
          localStorage.removeItem('negocioai_user');
          window.dispatchEvent(new Event('auth:expired'));
        }
      }
      throw new Error(data.error || `Error ${response.status}: Error al comunicarse con el servidor.`);
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose.');
    }
    throw error;
  }
};
