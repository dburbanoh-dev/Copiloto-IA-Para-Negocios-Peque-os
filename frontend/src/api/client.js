const API_BASE_URL = 'http://localhost:4000/api';

export const fetchApi = async (endpoint, options = {}) => {
  const token = localStorage.getItem('negocioai_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error al comunicarse con el servidor.');
  }

  return data;
};
