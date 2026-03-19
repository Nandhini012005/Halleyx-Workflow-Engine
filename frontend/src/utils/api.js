import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.response?.data?.message || err.message;
    return Promise.reject(new Error(msg));
  }
);

// Workflow APIs
export const workflowApi = {
  list: (params) => api.get('/workflows', { params }),
  get: (id) => api.get(`/workflows/${id}`),
  create: (data) => api.post('/workflows', data),
  update: (id, data) => api.put(`/workflows/${id}`, data),
  delete: (id) => api.delete(`/workflows/${id}`),
  execute: (id, data) => api.post(`/workflows/${id}/execute`, data),
};

// Step APIs
export const stepApi = {
  list: (workflowId) => api.get(`/workflows/${workflowId}/steps`),
  create: (workflowId, data) => api.post(`/workflows/${workflowId}/steps`, data),
  update: (id, data) => api.put(`/steps/${id}`, data),
  delete: (id) => api.delete(`/steps/${id}`),
};

// Rule APIs
export const ruleApi = {
  list: (stepId) => api.get(`/steps/${stepId}/rules`),
  create: (stepId, data) => api.post(`/steps/${stepId}/rules`, data),
  update: (id, data) => api.put(`/rules/${id}`, data),
  delete: (id) => api.delete(`/rules/${id}`),
  validate: (condition) => api.post('/rules/validate', { condition }),
};

// Execution APIs
export const executionApi = {
  list: (params) => api.get('/executions', { params }),
  get: (id) => api.get(`/executions/${id}`),
  cancel: (id) => api.post(`/executions/${id}/cancel`),
  retry: (id) => api.post(`/executions/${id}/retry`),
  approve: (id, data) => api.post(`/executions/${id}/approve`, data),
};

export default api;
