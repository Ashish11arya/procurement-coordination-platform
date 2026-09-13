import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { Role } from '../../src/shared/enums/roles.enum';
import { Permission } from '../../src/shared/enums/permissions.enum';
import { AuthenticatedUser } from '../../src/shared/types/auth.types';

describe('RBAC Middleware & Guards (Unit Tests)', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  const createMockContext = (user?: Partial<AuthenticatedUser>): ExecutionContext => {
    return {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  describe('RolesGuard', () => {
    let guard: RolesGuard;

    beforeEach(() => {
      guard = new RolesGuard(reflector);
    });

    it('should allow access if no roles are required on route', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockContext({ role: Role.FARMER });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when user role matches required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.CENTRE_ADMIN]);
      const context = createMockContext({
        userId: 'admin-1',
        role: Role.CENTRE_ADMIN,
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when user role is in multi-role list', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([Role.SYSTEM_ADMIN, Role.CENTRE_ADMIN]);
      const context = createMockContext({
        userId: 'sys-admin-1',
        role: Role.SYSTEM_ADMIN,
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException when user has insufficient role', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.CENTRE_ADMIN]);
      const context = createMockContext({
        userId: 'farmer-1',
        role: Role.FARMER,
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user context is missing', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.FARMER]);
      const context = createMockContext(undefined);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('PermissionsGuard', () => {
    let guard: PermissionsGuard;

    beforeEach(() => {
      guard = new PermissionsGuard(reflector);
    });

    it('should allow access if no permissions are required', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const context = createMockContext({ permissions: [] });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when user has all required permissions', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([Permission.WEIGHING_RECORD, Permission.WEIGHING_START]);
      const context = createMockContext({
        userId: 'operator-1',
        role: Role.WEIGHING_OPERATOR,
        permissions: [
          Permission.WEIGHING_START,
          Permission.WEIGHING_RECORD,
          Permission.WEIGHING_VIEW,
        ],
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException when user lacks one of the required permissions', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([Permission.QUALITY_APPROVE, Permission.QUALITY_ASSESS]);
      const context = createMockContext({
        userId: 'operator-1',
        role: Role.CHECKIN_OPERATOR,
        permissions: [Permission.CHECKIN_VERIFY],
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
