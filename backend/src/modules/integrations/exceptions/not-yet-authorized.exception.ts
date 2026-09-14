import { HttpException, HttpStatus } from '@nestjs/common';

export interface NotYetAuthorizedDetails {
  method: string;
  provider: string;
  requiredCredentials: string[];
  guidance: string;
  timestamp: string;
  additionalDetails?: Record<string, any>;
}

/**
 * ESamridhiNotYetAuthorizedException
 *
 * Thrown when an external call is attempted against the e-Samridhi (NAFED/MoAFW)
 * integration provider before official government API credentials / mTLS certificates
 * have been provisioned in the deployment environment.
 *
 * This guarantees no silent failures, no hardcoded synthetic data masquerading as real
 * government data, and clear, actionable error messages for operations and integration teams.
 */
export class ESamridhiNotYetAuthorizedException extends HttpException {
  readonly provider = 'ESAMRIDHI_GOVERNMENT_PROVIDER';
  readonly method: string;
  readonly requiredCredentials: string[];

  constructor(
    method: string,
    message?: string,
    additionalDetails?: Record<string, any>,
  ) {
    const requiredCredentials = [
      'ESAMRIDHI_API_BASE_URL',
      'ESAMRIDHI_CLIENT_ID',
      'ESAMRIDHI_CLIENT_SECRET',
      'ESAMRIDHI_API_KEY',
      'ESAMRIDHI_MTLS_CERT_PATH',
    ];

    const errorPayload = {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'GovernmentApiNotYetAuthorized',
      provider: 'ESAMRIDHI_GOVERNMENT_PROVIDER',
      method,
      message:
        message ||
        `Production API endpoint for ${method}() is awaiting official NAFED/MoAFW e-Samridhi API credentials and mutual TLS certificates.`,
      requiredCredentials,
      guidance:
        'To run the platform in demonstration/prototype mode with verified synthetic data, set GOVERNMENT_PROVIDER=mock in your .env file.',
      statutoryContext:
        'National e-Samridhi Portal operates under NAFED / Ministry of Agriculture & Farmers Welfare for Price Support Scheme (PSS) & Price Stabilisation Fund (PSF).',
      timestamp: new Date().toISOString(),
      ...additionalDetails,
    };

    super(errorPayload, HttpStatus.SERVICE_UNAVAILABLE);
    this.method = method;
    this.requiredCredentials = requiredCredentials;
  }
}
