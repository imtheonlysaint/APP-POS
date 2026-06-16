import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3600/api';
export const SERVER_URL = BASE_URL.replace(/\/api\/?$/, '');

const api = axios.create({
  baseURL: BASE_URL,
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if NOT already on login page to avoid refresh loop/redundant refresh
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ========================
// Auth API
// ========================
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/login', { username, password }),
  getMe: () => api.get('/me'),
};

// ========================
// Products API
// ========================
export const productsApi = {
  getAll: () => api.get('/products'),
  getById: (id: string) => api.get(`/products/${id}`),
  getByBarcode: (code: string) => api.get(`/products/variants/barcode/${code}`),
  create: (formData: FormData) =>
    api.post('/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string, formData: FormData) =>
    api.put(`/products/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string) => api.delete(`/products/${id}`),
};

// ========================
// Categories API
// ========================
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (data: { name: string; memberDiscountRate?: number | null }) =>
    api.post('/categories', data),
  update: (id: string, data: { name?: string; memberDiscountRate?: number | null }) =>
    api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// ========================
// Members API
// ========================
export const membersApi = {
  getAll: () => api.get('/members'),
  getById: (id: string) => api.get(`/members/${id}`),
  getByBarcode: (code: string) => api.get(`/members/barcode/${code}`),
  create: (data: { name: string; phone?: string; email?: string; barcode?: string }) =>
    api.post('/members', data),
  update: (id: string, data: { name?: string; phone?: string; email?: string; barcode?: string }) =>
    api.put(`/members/${id}`, data),
  delete: (id: string) => api.delete(`/members/${id}`),
};

// ========================
// Orders API
// ========================
export const ordersApi = {
  getAll: () => api.get('/orders'),
  getById: (id: string) => api.get(`/orders/${id}`),
  create: (data: {
    memberId?: string | null;
    paymentMethod: string;
    items: { variantId: string; quantity: number }[];
  }) => api.post('/orders', data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/orders/${id}/status`, { status }),
};

// ========================
// Stock API
// ========================
export const stockApi = {
  getLevel: (variantId: string) => api.get(`/stock/${variantId}`),
  adjust: (data: { variantId: string; quantityChange: number; reason: string }) =>
    api.post('/stock/adjust', data),
};

// ========================
// Analytics API
// ========================
export const analyticsApi = {
  getSummary: () => api.get('/analytics/summary'),
  getTopProducts: () => api.get('/analytics/top-products'),
  getSalesGraph: () => api.get('/analytics/sales-graph'),
};

// ========================
// Users API
// ========================
export const usersApi = {
  getAll: () => api.get('/users'),
  getRoles: () => api.get('/roles'),
  create: (data: { username: string; password: string; roleId: string }) =>
    api.post('/users', data),
  delete: (id: string) => api.delete(`/users/${id}`),
};
