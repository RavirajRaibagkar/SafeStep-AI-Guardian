import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api';
// 10.0.2.2 = Android emulator → host machine
// Change to your actual server URL for production

const apiInstance = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: inject JWT token
apiInstance.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {}
  return config;
});

// Response interceptor: handle 401 + retry logic
apiInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token');
      // Navigation to login would be handled by app state
      return Promise.reject(error);
    }

    // Retry on network errors (up to 3 times)
    if (!error.response && !config._retryCount) {
      config._retryCount = 1;
      await new Promise(res => setTimeout(res, 1000 * config._retryCount));
      return apiInstance(config);
    }
    if (!error.response && config._retryCount < 3) {
      config._retryCount += 1;
      await new Promise(res => setTimeout(res, 1000 * config._retryCount));
      return apiInstance(config);
    }

    return Promise.reject(error);
  }
);

export const api = apiInstance;

// Auth helpers
export const authApi = {
  register: (data: any) => apiInstance.post('/auth/register', data),
  login: (phone: string, password: string) => apiInstance.post('/auth/login', { phone, password }),
  getProfile: () => apiInstance.get('/auth/profile'),
  updateProfile: (data: any) => apiInstance.put('/auth/profile', data),
};

// SOS helpers
export const sosApi = {
  trigger: (lat: number, lng: number, triggerType: string, aiData?: any) =>
    apiInstance.post('/sos/trigger', { lat, lng, trigger_type: triggerType, ...aiData }),
  uploadAudio: (formData: FormData) =>
    apiInstance.post('/sos/audio-upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getCase: (caseId: string) => apiInstance.get(`/sos/case/${caseId}`),
  cancel: (caseId: string) => apiInstance.post(`/sos/cancel/${caseId}`),
};

// Hotspot helpers
export const hotspotApi = {
  getZones: (lat: number, lng: number) => apiInstance.get(`/hotspots/zones?lat=${lat}&lng=${lng}`),
  getNearby: (lat: number, lng: number) => apiInstance.get(`/hotspots/nearby?lat=${lat}&lng=${lng}`),
  scoreRoute: (waypoints: string) => apiInstance.get(`/hotspots/route-score?waypoints=${waypoints}`),
};

// Police helpers
export const policeApi = {
  getNearest: (lat: number, lng: number) => apiInstance.get(`/police/nearest?lat=${lat}&lng=${lng}`),
  getETA: (stationId: number, caseId: string, lat: number, lng: number) =>
    apiInstance.get(`/police/eta?station_id=${stationId}&case_id=${caseId}&lat=${lat}&lng=${lng}`),
};

// Cases helpers
export const casesApi = {
  list: (page = 1) => apiInstance.get(`/cases/list?page=${page}`),
  getDetail: (caseId: string) => apiInstance.get(`/cases/${caseId}`),
  resolve: (caseId: string, notes: string) => apiInstance.post(`/cases/${caseId}/resolve`, { notes }),
};

// Geofence helpers
export const geofenceApi = {
  create: (name: string, lat: number, lng: number, radius: number) =>
    apiInstance.post('/geofence/create', { name, lat, lng, radius }),
  list: () => apiInstance.get('/geofence/list'),
  check: (lat: number, lng: number) => apiInstance.post('/geofence/check', { lat, lng }),
};
