import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 10000,
});

export const fetchStats = () => api.get('/api/tokens/stats').then(r => r.data);
export const fetchHoneytokens = () => api.get('/api/tokens/honeytokens').then(r => r.data);
export const fetchIncidents = (params = {}) => api.get('/api/incidents', { params }).then(r => r.data);
export const fetchIncident = (id) => api.get(`/api/incidents/${id}`).then(r => r.data);
export const triggerTestAttack = (body = {}) => api.post('/api/test/trigger-attack', body).then(r => r.data);
export const plantHoneytoken = (body) => api.post('/api/tokens/honeytokens', body).then(r => r.data);

export default api;
