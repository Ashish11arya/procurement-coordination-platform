import { AuditService } from '../../src/modules/audit/audit.service';
import { AuditAction, AuditSource } from '../../src/modules/audit/schemas/audit-log.schema';
import { Role } from '../../src/shared/enums/roles.enum';

describe('AuditService (Unit Tests)', () => {
  let auditService: AuditService;
  let mockModel: any;

  beforeEach(() => {
    mockModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      save: jest.fn().mockResolvedValue({ _id: 'audit-log-1', ...dto }),
    }));
    mockModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
    mockModel.countDocuments = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    auditService = new AuditService(mockModel);
  });

  it('should successfully record an audit log entry', async () => {
    const entry = await auditService.logAction({
      requestId: 'req-12345',
      action: AuditAction.AUTH_LOGIN_PASSWORD,
      who: {
        userId: 'user-001',
        role: Role.CENTRE_ADMIN,
        email: 'admin@gov.in',
        ipAddress: '192.168.1.1',
      },
      target: {
        entityType: 'User',
        entityId: 'user-001',
      },
      source: AuditSource.HTTP_API,
      status: 'SUCCESS',
    });

    expect(entry).toBeDefined();
    expect(mockModel).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-12345',
        action: AuditAction.AUTH_LOGIN_PASSWORD,
      }),
    );
  });

  it('should redact sensitive keys (password, tokens, otp) from audit payloads', async () => {
    await auditService.logAction({
      requestId: 'req-secure-1',
      action: AuditAction.OPERATOR_CREATED,
      who: {
        userId: 'admin-001',
        role: Role.SYSTEM_ADMIN,
        ipAddress: '127.0.0.1',
      },
      target: { entityType: 'User', entityId: 'op-002' },
      newValue: {
        username: 'operator1',
        password: 'super_secret_password',
        refreshToken: 'refresh-jwt-secret-token',
        otp: '654321',
        nested: {
          token: 'sensitive-token',
          safeField: 'visible-data',
        },
      },
    });

    const calledWith = mockModel.mock.calls[0][0];
    expect(calledWith.newValue.password).toBe('[REDACTED]');
    expect(calledWith.newValue.refreshToken).toBe('[REDACTED]');
    expect(calledWith.newValue.otp).toBe('[REDACTED]');
    expect(calledWith.newValue.nested.token).toBe('[REDACTED]');
    expect(calledWith.newValue.nested.safeField).toBe('visible-data');
  });

  it('should query logs with pagination and filters', async () => {
    const result = await auditService.queryLogs({
      userId: 'user-001',
      action: AuditAction.AUTH_LOGIN_PASSWORD,
      limit: 10,
      skip: 0,
    });

    expect(result).toHaveProperty('logs');
    expect(result).toHaveProperty('total');
    expect(mockModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        'who.userId': 'user-001',
        action: AuditAction.AUTH_LOGIN_PASSWORD,
      }),
    );
  });
});
