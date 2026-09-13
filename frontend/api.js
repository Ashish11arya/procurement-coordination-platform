/**
 * National Procurement Coordination Platform - API Service Client
 * Enterprise-grade multi-persona client connecting directly to backend REST endpoints at /api/v1
 */

const API_BASE = '/api/v1';

class ApiService {
  constructor() {
    this.sessions = {
      farmer: { token: null, user: null },
      operator: { token: null, user: null },
      admin: { token: null, user: null },
    };
    this.activePersona = 'farmer';
    this.loadPersistedSessions();
  }

  loadPersistedSessions() {
    try {
      const saved = localStorage.getItem('sih_enterprise_sessions');
      if (saved) {
        this.sessions = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[API] Could not load persisted sessions:', e);
    }
  }

  saveSessions() {
    try {
      localStorage.setItem('sih_enterprise_sessions', JSON.stringify(this.sessions));
    } catch (e) {
      console.warn('[API] Could not persist sessions:', e);
    }
  }

  setSession(roleKey, token, user) {
    if (this.sessions[roleKey]) {
      this.sessions[roleKey] = { token, user };
      this.saveSessions();
    }
  }

  setActivePersona(roleKey) {
    if (this.sessions[roleKey]) {
      this.activePersona = roleKey;
      console.log(`[API] Active Persona switched to: ${roleKey.toUpperCase()}`);
      if (window.onPersonaChanged) {
        window.onPersonaChanged(roleKey, this.sessions[roleKey]);
      }
    }
  }

  getTokenForEndpoint(endpoint, explicitPersona = null) {
    if (explicitPersona && this.sessions[explicitPersona]?.token) {
      return this.sessions[explicitPersona].token;
    }

    if (endpoint.startsWith('/auth/farmer') || endpoint.startsWith('/bookings')) {
      return this.sessions.farmer?.token || this.sessions.operator?.token;
    }

    if (endpoint.startsWith('/operations') || endpoint.startsWith('/scheduling')) {
      return this.sessions.operator?.token || this.sessions.admin?.token;
    }

    if (endpoint.startsWith('/command-centre')) {
      return this.sessions.admin?.token || this.sessions.operator?.token;
    }

    // Default to active persona or operator
    return this.sessions[this.activePersona]?.token || this.sessions.operator?.token;
  }

  async request(endpoint, options = {}, explicitPersona = null) {
    const url = `${API_BASE}${endpoint}`;
    const token = this.getTokenForEndpoint(endpoint, explicitPersona);

    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest', // Anti-CSRF verification header
      ...(options.headers || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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
  // Session Bootstrapper: Authenticates all 3 Personas for Zero Friction
  // ==========================================================================
  async initSessions() {
    console.log('[API] Bootstrapping enterprise role sessions...');

    // 1. Authenticate Farmer (Ramesh Verma, mobile 9876543210)
    try {
      const otpRes = await this.requestFarmerOtp('9876543210');
      const verifyRes = await this.verifyFarmerOtp('9876543210', otpRes.mockOtp || '123456');
      this.setSession('farmer', verifyRes.accessToken, verifyRes.user);
      console.log('[API] ✓ Farmer session active:', verifyRes.user?.name);
    } catch (e) {
      console.warn('[API] Farmer session init warning:', e.message);
    }

    // 2. Authenticate Mandi Operator (Sanwer Mandi In-Charge)
    try {
      const opRes = await this.loginOperator('operator', 'Operator@123');
      this.setSession('operator', opRes.accessToken || opRes.tokens?.accessToken, opRes.user);
      console.log('[API] ✓ Operator session active:', opRes.user?.name);
    } catch (e) {
      console.warn('[API] Operator session init warning:', e.message);
    }

    // 3. Authenticate Government Admin (Central Control Officer)
    try {
      const adminRes = await this.loginOperator('admin', 'Admin@123');
      this.setSession('admin', adminRes.accessToken || adminRes.tokens?.accessToken, adminRes.user);
      console.log('[API] ✓ Admin session active:', adminRes.user?.name);
    } catch (e) {
      console.warn('[API] Admin session init warning:', e.message);
    }

    return this.sessions;
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
      this.setSession('farmer', res.accessToken, res.user);
    }
    return res;
  }

  async loginOperator(identifier, password) {
    const res = await this.request('/auth/operator/login', {
      method: 'POST',
      body: { identifier, password },
    });
    const token = res.accessToken || res.tokens?.accessToken;
    if (token) {
      const key = res.user?.role === 'GOVERNMENT_ADMIN' ? 'admin' : 'operator';
      this.setSession(key, token, res.user);
    }
    return res;
  }

  // ==========================================================================
  // Bookings Endpoints (Farmer Persona)
  // ==========================================================================
  async getFarmerBookings() {
    return this.request('/bookings', { method: 'GET' }, 'farmer');
  }

  async createBooking(bookingPayload) {
    return this.request('/bookings', {
      method: 'POST',
      body: bookingPayload,
    }, 'farmer');
  }

  async cancelBooking(bookingId, reason = 'Farmer voluntary cancellation') {
    return this.request(`/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      body: { reason },
    }, 'farmer');
  }

  // ==========================================================================
  // Ground Operations Endpoints (Operator Persona)
  // ==========================================================================
  async getCentreDashboard(centreId) {
    return this.request(`/operations/centres/${centreId}/dashboard`, { method: 'GET' }, 'operator');
  }

  async checkInVehicle(dto) {
    return this.request('/operations/check-in', {
      method: 'POST',
      body: dto,
    }, 'operator');
  }

  async startWeighing(dto) {
    return this.request('/operations/weighing/start', {
      method: 'POST',
      body: dto,
    }, 'operator');
  }

  async completeWeighing(dto) {
    return this.request('/operations/weighing/complete', {
      method: 'POST',
      body: dto,
    }, 'operator');
  }

  async recordQuality(dto) {
    return this.request('/operations/quality', {
      method: 'POST',
      body: dto,
    }, 'operator');
  }

  async recordProcurement(dto) {
    return this.request('/operations/procurement', {
      method: 'POST',
      body: dto,
    }, 'operator');
  }

  // High-level Ground Operation Helpers
  async executeFullWeighment(bookingId, vehicleNumber, grossWeight = 42.5, tareWeight = 12.5) {
    await this.startWeighing({
      bookingId,
      counterId: 'CTR-WEIGH-01',
      vehicleNumber,
    });
    return this.completeWeighing({
      bookingId,
      counterId: 'CTR-WEIGH-01',
      vehicleNumber,
      grossWeightQuintals: grossWeight,
      tareWeightQuintals: tareWeight,
      notes: 'Electronic weighbridge scale 1 reading verified',
    });
  }

  async executeQualityAssay(bookingId, grade = 'GRADE_A', moisture = 11.4) {
    return this.recordQuality({
      bookingId,
      counterId: 'CTR-QUAL-01',
      moisturePercentage: moisture,
      foreignMatterPercentage: 0.8,
      damagedGrainsPercentage: 0.5,
      assignedGrade: grade,
      verdict: 'ACCEPTED',
      notes: 'Govt standard moisture limit <= 12.0% satisfied',
    });
  }

  async executeProcurementHandoff(bookingId, finalQty = 30.0, mspRate = 2275) {
    return this.recordProcurement({
      bookingId,
      counterId: 'CTR-PROC-01',
      finalQuantityQuintals: finalQty,
      mspRatePerQuintal: mspRate,
      notes: 'e-Sign verified; payment advice transmitted to DBT portal',
    });
  }

  // ==========================================================================
  // Scheduling & Dynamic Adaptation
  // ==========================================================================
  async triggerCounterBreakdown(centreId, counterId, date = '2026-04-15') {
    return this.request(
      `/scheduling/centres/${centreId}/counters/${counterId}/breakdown?date=${date}`,
      { method: 'POST' },
      'operator'
    );
  }

  // ==========================================================================
  // Command Centre Endpoints (Admin Persona)
  // ==========================================================================
  async getCentresSummary(districtId) {
    const query = districtId ? `?districtId=${districtId}` : '';
    return this.request(`/command-centre/centres${query}`, { method: 'GET' }, 'admin');
  }

  async getStatesSummary() {
    return this.request('/command-centre/states', { method: 'GET' }, 'admin');
  }

  // ==========================================================================
  // Section 42 Demonstration Suite Endpoints
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
    return this.request('/demo/roster', { method: 'GET' });
  }
}

// Global API instance
window.api = new ApiService();
