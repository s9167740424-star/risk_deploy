import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (fullName: string, email: string, password: string) =>
    api.post('/auth/register', { full_name: fullName, email, password }),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  guestLogin: () => api.post('/auth/guest'),
};

export const propertiesApi = {
  getAll: () => api.get('/properties'),
  getById: (id: number) => api.get(`/properties/${id}`),
  search: (query: string) => api.get('/properties', { params: { q: query } }),
  lookup: (query: string) => api.get('/properties/lookup', { params: { q: query } }),
};

export const documentsApi = {
  getAll: () => api.get('/documents'),
  getSources: () => api.get('/documents/sources'),
  toggleDocument: (documentId: number) =>
    api.post(`/documents/${documentId}/toggle`),
};

export const algorithmsApi = {
  getAll: () => api.get('/algorithms'),
  getTree: () => api.get('/algorithms/tree'),
  getOne: (algorithmId: number) => api.get(`/algorithms/${algorithmId}`),
  getByCode: (code: string) => api.get(`/algorithms/by-code/${code}`),
  toggleStep: (stepId: number) =>
    api.post(`/algorithms/steps/${stepId}/toggle`),
};

export const materialsApi = {
  getAll: (params?: { q?: string; category?: string }) =>
    api.get('/materials', { params }),
  getById: (id: number) => api.get(`/materials/${id}`),
  getBySlug: (slug: string) => api.get(`/materials/by-slug/${slug}`),
  fileUrl: (id: number) => `/api/materials/${id}/file`,
};

export const mapApi = {
  search: (query: string) => api.get('/map/search', { params: { q: query } }),
  getPropertyContext: (propertyId: number) =>
    api.get(`/map/property/${propertyId}`),
  lookup: (query: string) => api.get('/map/lookup', { params: { q: query } }),
  geoLookup: (query: string, coords?: { lat: number; lon: number }) =>
    api.get('/map/geo-lookup', {
      params: coords ? { q: query, lat: coords.lat, lon: coords.lon } : { q: query },
    }),
  getConfig: () => api.get('/map/config'),
  getOffices: (lat: number, lon: number, radius?: number) =>
    api.get('/map/offices', { params: { lat, lon, radius } }),
};

export const surveyApi = {
  getSchema: () => api.get('/questionnaire/schema'),
  getData: () => api.get('/questionnaire'),
  submit: (payload: Record<string, unknown>) =>
    api.put('/questionnaire', payload),
};

export type SearchHit = {
  type: 'article' | 'algorithm';
  id: string;
  title: string;
  subtitle?: string;
  score?: number;
};

export const searchApi = {
  query: (q: string) =>
    api.get<{ items: SearchHit[]; query: string }>('/search', { params: { q } }),
  corpus: () =>
    api.get<{ items: Array<SearchHit & { text?: string }> }>('/search/corpus'),
};

export const userGeoApi = {
  get: () => api.get('/user-geo'),
  save: (payload: Record<string, unknown>) => api.put('/user-geo', payload),
};

export default api;
