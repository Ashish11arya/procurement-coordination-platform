import { telemetry } from './telemetry';
import {
  Booking,
  Centre,
  CentreDashboardData,
  Counter,
  User,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '') + '/api/v1';

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('procurement_auth_token');
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest', // Anti-CSRF header
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    const startTime = performance.now();
    const method = options.method || 'GET';

    try {
      const response = await fetch(url, config);
      const durationMs = (performance.now() - startTime).toFixed(1);

      let data: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      telemetry.logHttp(method, endpoint, response.status, durationMs, response.ok);

      if (!response.ok) {
        const errorMsg = data?.message || `Request failed with status ${response.status}`;
        throw new ApiError(errorMsg, response.status);
      }

      return data as T;
    } catch (err: any) {
      if (!(err instanceof ApiError)) {
        telemetry.logHttp(method, endpoint, 'NET_ERR', (performance.now() - startTime).toFixed(1), false);
      }
      throw err;
    }
  }

  // ==========================================================================
  // Auth Endpoints
  // ==========================================================================
  async requestFarmerOtp(mobile: string): Promise<{ mobile: string; expiresInSeconds: number; mockOtp?: string }> {
    return this.request('/auth/farmer/otp/request', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    });
  }

  async verifyFarmerOtp(mobile: string, otp: string): Promise<{ user: User; accessToken: string; expiresIn: number }> {
    return this.request('/auth/farmer/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ mobile, otp }),
    });
  }

  async registerFarmer(data: {
    mobile: string;
    name: string;
    state: string;
    district: string;
    subDistrict?: string;
    village?: string;
    landAreaAcres?: number;
    consentToDataSharing: boolean;
    consentVersion?: string;
  }): Promise<{ user: User; accessToken: string; expiresIn: number }> {
    return this.request('/auth/farmer/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async loginOperator(identifier: string, password: string, mfaCode?: string): Promise<{ user: User; tokens?: { accessToken: string }; accessToken?: string }> {
    return this.request('/auth/operator/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, mfaCode }),
    });
  }

  // ==========================================================================
  // Bookings Endpoints
  // ==========================================================================
  async getFarmerBookings(): Promise<{ success: boolean; count: number; bookings: Booking[] }> {
    return this.request('/bookings', { method: 'GET' });
  }

  async createBooking(bookingPayload: any): Promise<{ success: boolean; booking: Booking; arrivalWindow: any }> {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingPayload),
    });
  }

  async getBookingById(bookingId: string): Promise<{ success: boolean; booking: Booking }> {
    return this.request(`/bookings/${bookingId}`, { method: 'GET' });
  }

  async cancelBooking(bookingId: string, reason: string): Promise<{ success: boolean; message: string; booking: Booking }> {
    return this.request(`/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }

  // ==========================================================================
  // Centres Endpoints
  // ==========================================================================
  async getCentres(district?: string): Promise<Centre[]> {
    const q = district ? `?district=${district}` : '';
    return this.request(`/centres${q}`, { method: 'GET' });
  }

  async getCentreById(centreId: string): Promise<Centre> {
    return this.request(`/centres/${centreId}`, { method: 'GET' });
  }

  // ==========================================================================
  // Operations & Centre Dashboard Endpoints
  // ==========================================================================
  async getCentreDashboard(centreId: string): Promise<CentreDashboardData> {
    return this.request(`/operations/centres/${centreId}/dashboard`, { method: 'GET' });
  }

  async checkInVehicle(data: {
    bookingId: string;
    tokenNumber: string;
    vehicleNumber: string;
    notes?: string;
  }): Promise<any> {
    return this.request('/operations/check-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async startWeighing(data: {
    bookingId: string;
    counterId: string;
    vehicleNumber: string;
  }): Promise<any> {
    return this.request('/operations/weighing/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async completeWeighing(data: {
    bookingId: string;
    counterId: string;
    vehicleNumber: string;
    grossWeightQuintals: number;
    tareWeightQuintals: number;
    notes?: string;
  }): Promise<any> {
    return this.request('/operations/weighing/complete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async recordQuality(data: {
    bookingId: string;
    counterId: string;
    moisturePercentage: number;
    foreignMatterPercentage: number;
    damagedGrainsPercentage: number;
    assignedGrade: string;
    verdict: string;
    notes?: string;
  }): Promise<any> {
    return this.request('/operations/quality', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async recordProcurement(data: {
    bookingId: string;
    counterId: string;
    finalQuantityQuintals: number;
    mspRatePerQuintal: number;
    notes?: string;
  }): Promise<any> {
    return this.request('/operations/procurement', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==========================================================================
  // Scheduling & Counter Breakdown Endpoints
  // ==========================================================================
  async triggerCounterBreakdown(centreId: string, counterId: string, date: string = '2026-04-15'): Promise<any> {
    return this.request(`/scheduling/centres/${centreId}/counters/${counterId}/breakdown?date=${date}`, {
      method: 'POST',
    });
  }

  // ==========================================================================
  // Government Command Centre Endpoints
  // ==========================================================================
  async getStatesSummary(): Promise<any> {
    return this.request('/command-centre/states', { method: 'GET' });
  }

  async getDistrictsSummary(state?: string): Promise<any> {
    const q = state ? `?state=${state}` : '';
    return this.request(`/command-centre/districts${q}`, { method: 'GET' });
  }

  async getCentresSummary(district?: string): Promise<{ date: string; totalCentres: number; centres: any[] }> {
    const q = district ? `?district=${district}` : '';
    return this.request(`/command-centre/centres${q}`, { method: 'GET' });
  }

  // ==========================================================================
  // Section 42 Demonstration Runner Endpoints
  // ==========================================================================
  async resetAndSeedDemo(): Promise<any> {
    return this.request('/demo/reset-and-seed', { method: 'POST' });
  }

  async executeDemoStep(stepNumber: number | string): Promise<any> {
    return this.request(`/demo/step/${stepNumber}`, { method: 'POST' });
  }

  async runFullDemoScenario(): Promise<any> {
    return this.request('/demo/run-scenario', { method: 'POST' });
  }

  async getLiveDemoRoster(): Promise<{ success: boolean; centreId: string; counters: Counter[]; roster: any[] }> {
    return this.request('/demo/roster', { method: 'GET' });
  }

  // ==========================================================================
  // DPDP Act 2023 Data Subject Rights & Statutory Compliance Endpoints
  // ==========================================================================
  async exportFarmerData(): Promise<any> {
    return this.request('/farmers/data-export', { method: 'GET' });
  }

  async deleteFarmerAccount(reason?: string): Promise<{ success: boolean; message: string; statutoryRetentionNotice: string; anonymizedRecord: any }> {
    return this.request('/farmers/account', {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  }

  async getComplianceRetentionStatus(): Promise<any> {
    return this.request('/compliance/retention/status', { method: 'GET' });
  }

  async triggerComplianceRetentionRun(dryRun: boolean = true): Promise<any> {
    return this.request(`/compliance/retention/run?dryRun=${dryRun}`, { method: 'POST' });
  }
}

export const api = new ApiService();
