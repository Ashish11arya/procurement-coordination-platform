import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QueueStateMachine } from '../../src/modules/queue/queue-state-machine';
import { QueueStatus } from '../../src/modules/queue/schemas/queue-state.schema';
import { Role } from '../../src/shared/enums/roles.enum';

describe('QueueStateMachine (Unit Tests)', () => {
  describe('Valid Queue Transitions (Section 9)', () => {
    it('should allow sequential progression through operational lifecycle', () => {
      // BOOKED -> CONFIRMED
      expect(QueueStateMachine.canTransition(QueueStatus.BOOKED, QueueStatus.CONFIRMED)).toBe(true);

      // CONFIRMED -> ARRIVED
      expect(QueueStateMachine.canTransition(QueueStatus.CONFIRMED, QueueStatus.ARRIVED)).toBe(true);

      // ARRIVED -> CHECKED_IN
      expect(QueueStateMachine.canTransition(QueueStatus.ARRIVED, QueueStatus.CHECKED_IN)).toBe(true);

      // CHECKED_IN -> WAITING
      expect(QueueStateMachine.canTransition(QueueStatus.CHECKED_IN, QueueStatus.WAITING)).toBe(true);

      // WAITING -> PROCESSING
      expect(QueueStateMachine.canTransition(QueueStatus.WAITING, QueueStatus.PROCESSING)).toBe(true);

      // PROCESSING -> COMPLETED
      expect(QueueStateMachine.canTransition(QueueStatus.PROCESSING, QueueStatus.COMPLETED)).toBe(true);
    });

    it('should allow stage-to-stage waiting transitions during processing', () => {
      // PROCESSING (Weighing done) -> WAITING (in line for Quality)
      expect(QueueStateMachine.canTransition(QueueStatus.PROCESSING, QueueStatus.WAITING)).toBe(true);

      // WAITING -> PROCESSING (called to Quality counter)
      expect(QueueStateMachine.canTransition(QueueStatus.WAITING, QueueStatus.PROCESSING)).toBe(true);
    });

    it('should allow hold and quality dispute handling', () => {
      // PROCESSING -> HELD
      expect(QueueStateMachine.canTransition(QueueStatus.PROCESSING, QueueStatus.HELD)).toBe(true);

      // HELD -> WAITING (dispute resolved)
      expect(QueueStateMachine.canTransition(QueueStatus.HELD, QueueStatus.WAITING)).toBe(true);

      // HELD -> REJECTED (dispute confirmed FAQ failure)
      expect(QueueStateMachine.canTransition(QueueStatus.HELD, QueueStatus.REJECTED)).toBe(true);
    });

    it('should allow pre-arrival cancellations and no-shows', () => {
      expect(QueueStateMachine.canTransition(QueueStatus.BOOKED, QueueStatus.CANCELLED)).toBe(true);
      expect(QueueStateMachine.canTransition(QueueStatus.BOOKED, QueueStatus.NO_SHOW)).toBe(true);
      expect(QueueStateMachine.canTransition(QueueStatus.CONFIRMED, QueueStatus.CANCELLED)).toBe(true);
      expect(QueueStateMachine.canTransition(QueueStatus.CONFIRMED, QueueStatus.NO_SHOW)).toBe(true);
    });
  });

  describe('Invalid Transition Rejection', () => {
    it('should throw BadRequestException when skipping operational stages', () => {
      // Direct jump from BOOKED to COMPLETED is impossible physically
      expect(() =>
        QueueStateMachine.validateTransition(QueueStatus.BOOKED, QueueStatus.COMPLETED),
      ).toThrow(BadRequestException);

      // Cannot jump from BOOKED directly to PROCESSING without gate arrival and checkin
      expect(() =>
        QueueStateMachine.validateTransition(QueueStatus.BOOKED, QueueStatus.PROCESSING),
      ).toThrow(BadRequestException);
    });

    it('should prevent mutating terminal states', () => {
      // COMPLETED cannot be changed
      expect(() =>
        QueueStateMachine.validateTransition(QueueStatus.COMPLETED, QueueStatus.WAITING),
      ).toThrow(BadRequestException);

      // CANCELLED cannot be revived
      expect(() =>
        QueueStateMachine.validateTransition(QueueStatus.CANCELLED, QueueStatus.ARRIVED),
      ).toThrow(BadRequestException);

      // NO_SHOW cannot be revived
      expect(() =>
        QueueStateMachine.validateTransition(QueueStatus.NO_SHOW, QueueStatus.CHECKED_IN),
      ).toThrow(BadRequestException);

      // REJECTED cannot proceed to completed
      expect(() =>
        QueueStateMachine.validateTransition(QueueStatus.REJECTED, QueueStatus.COMPLETED),
      ).toThrow(BadRequestException);
    });
  });

  describe('Role-Based Transition Authorization (Section 5 & 9)', () => {
    it('should allow Check-in operator to perform CHECKED_IN', () => {
      expect(() =>
        QueueStateMachine.checkRoleAuthorization(Role.CHECKIN_OPERATOR, QueueStatus.CHECKED_IN),
      ).not.toThrow();
    });

    it('should forbid Farmer from self-marking CHECKED_IN', () => {
      expect(() =>
        QueueStateMachine.checkRoleAuthorization(Role.FARMER, QueueStatus.CHECKED_IN),
      ).toThrow(ForbiddenException);
    });

    it('should allow Weighing and Quality operators to update PROCESSING', () => {
      expect(() =>
        QueueStateMachine.checkRoleAuthorization(Role.WEIGHING_OPERATOR, QueueStatus.PROCESSING),
      ).not.toThrow();

      expect(() =>
        QueueStateMachine.checkRoleAuthorization(Role.QUALITY_OPERATOR, QueueStatus.PROCESSING),
      ).not.toThrow();
    });

    it('should allow Procurement operator to finalize COMPLETED', () => {
      expect(() =>
        QueueStateMachine.checkRoleAuthorization(Role.PROCUREMENT_OPERATOR, QueueStatus.COMPLETED),
      ).not.toThrow();
    });

    it('should allow Centre Administrator full governance authority', () => {
      expect(() =>
        QueueStateMachine.checkRoleAuthorization(Role.CENTRE_ADMIN, QueueStatus.HELD),
      ).not.toThrow();

      expect(() =>
        QueueStateMachine.checkRoleAuthorization(Role.CENTRE_ADMIN, QueueStatus.CANCELLED),
      ).not.toThrow();
    });
  });
});
