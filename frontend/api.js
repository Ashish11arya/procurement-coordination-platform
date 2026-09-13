/**
 * National Procurement Coordination Platform - API Service Client
 * Connects directly to backend REST endpoints at /api/v1
 */

const API_BASE = '/api/v1';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('sih_access_token') || null;
    this.user = JSON.parse(localStorage.getItem('sih_user') || 'null');
  }

  setToken(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem('sih_access_token', token);
      localStorage.setItem('sih_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sih_access_token');
      localStorage.removeItem('sih_user');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest', // CSRF bypass header
      ...(options.headers || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const startTime = performance.now();
    try {
      const response = await fetch(url, config);
      const durationMs = (performance.now() - startTime).toFixed(1);

      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (window.onApiCallLogged) {
        window.onApiCallLogged({
          method: options.method || 'GET',
          endpoint,
          status: response.status,
          durationMs,
          success: response.ok,
        });
      }

      if (!response.ok) {
        throw new Error(data.message || `API Error (${response.status})`);
      }

      return data;
    } catch (err) {
      if (window.onApiCallLogged) {
        window.onApiCallLogged({
          method: options.method || 'GET',
          endpoint,
          status: 'ERROR',
          durationMs: (performance.now() - startTime).toFixed(1),
          success: false,
          error: err.message,
        });
      }
      throw err;
    }
  }

  // ==========================================================================
  // Auth Endpoints
  // ==========================================================================
  async requestFarmerOtp(mobile) {
    return this.request('/auth/farmer/otp/request', {
      method: 'POST',
      body: { mobile },
    });
  }

  async verifyFarmerOtp(mobile, otp) {
    const res = await this.request('/auth/farmer/otp/verify', {
      method: 'POST',
      body: { mobile, otp },
    });
    if (res.accessToken) {
      this.setToken(res.accessToken, res.user);
    }
    return res;
  }

  async loginOperator(username, password) {
    const res = await this.request('/auth/operator/login', {
      method: 'POST',
      body: { identifier: username, password },
    });
    if (res.tokens?.accessToken) {
      this.setToken(res.tokens.accessToken, res.user);
    }
    return res;
  }

  // ==========================================================================
  // Bookings Endpoints
  // ==========================================================================
  async getFarmerBookings() {
    return this.request('/bookings');
  }

  async createBooking(bookingPayload) {
    return this.request('/bookings', {
      method: 'POST',
      body: bookingPayload,
    });
  }

  async cancelBooking(bookingId, reason = 'Farmer cancelled') {
    return this.request(`/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      body: { reason },
    });
  }

  // ==========================================================================
  // Operations & Centre Dashboard
  // ==========================================================================
  async getCentreDashboard(centreId) {
    return this.request(`/operations/centres/${centreId}/dashboard`);
  }

  async checkInVehicle(checkInDto) {
    return this.request('/operations/check-in', {
      method: 'POST',
      body: checkInDto,
    });
  }

  // ==========================================================================
  // Scheduling & Dynamic Adaptation
  // ==========================================================================
  async triggerCounterBreakdown(centreId, counterId, date) {
    return this.request(
      `/scheduling/centres/${centreId}/counters/${counterId}/breakdown?date=${date}`,
      { method: 'POST' },
    );
  }

  // ==========================================================================
  // Command Centre
  // ==========================================================================
  async getCentresSummary(districtId) {
    const query = districtId ? `?districtId=${districtId}` : '';
    return this.request(`/command-centre/centres${query}`);
  }

  // ==========================================================================
  // Section 42 Demonstration Runner Endpoints
  // ==========================================================================
  async resetAndSeedDemo() {
    return this.request('/demo/reset-and-seed', { method: 'POST' });
  }

  async executeDemoStep(stepNumber) {
    return this.request(`/demo/step/${stepNumber}`, { method: 'POST' });
  }

  async runFullDemoScenario() {
    return this.request('/demo/run-scenario', { method: 'POST' });
  }

  async getLiveDemoRoster() {
    return this.request('/demo/roster');
  }
}

// Global API instance
window.api = new ApiService();
