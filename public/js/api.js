const BASE = '';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('sl_token');
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data = {};
  try {
    data = await res.json();
  } catch (err) {
    data = {};
  }

  if (res.status === 401) {
    localStorage.removeItem('sl_token');
    localStorage.removeItem('sl_user');
    if (!location.pathname.endsWith('/index.html') && location.pathname !== '/') window.location.href = '/index.html';
    return undefined;
  }

  if (!res.ok) throw new Error(data.message || 'API error');
  return data;
}

const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body }),
  put: (path, body) => apiFetch(path, { method: 'PUT', body }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body }),
  delete: (path) => apiFetch(path, { method: 'DELETE' })
};
