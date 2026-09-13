import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QueueStatus } from './schemas/queue-state.schema';
import { Role } from '../../shared/enums/roles.enum';

/**
 * Queue State Machine Definition (Section 9 of PROJECT_SPEC.md)
 */
export const VALID_QUEUE_TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  [QueueStatus.BOOKED]: [
    QueueStatus.CONFIRMED,
    QueueStatus.CANCELLED,
    QueueStatus.NO_SHOW,
  ],
  [QueueStatus.CONFIRMED]: [
    QueueStatus.ARRIVED,
    QueueStatus.CANCELLED,
    QueueStatus.NO_SHOW,
  ],
  [QueueStatus.ARRIVED]: [
    QueueStatus.CHECKED_IN,
    QueueStatus.CANCELLED,
    QueueStatus.NO_SHOW,
  ],
  [QueueStatus.CHECKED_IN]: [
    QueueStatus.WAITING,
    QueueStatus.REJECTED,
  ],
  [QueueStatus.WAITING]: [
    QueueStatus.PROCESSING,
    QueueStatus.HELD,
    QueueStatus.CANCELLED,
  ],
  [QueueStatus.PROCESSING]: [
    QueueStatus.WAITING, // Moving between sequential counters (e.g. Weighing -> waiting for Quality)
    QueueStatus.COMPLETED,
    QueueStatus.REJECTED,
    QueueStatus.HELD,
  ],
  [QueueStatus.HELD]: [
    QueueStatus.WAITING,
    QueueStatus.REJECTED,
    QueueStatus.CANCELLED,
  ],
  // Terminal states (Section 9)
  [QueueStatus.COMPLETED]: [],
  [QueueStatus.CANCELLED]: [],
  [QueueStatus.NO_SHOW]: [],
  [QueueStatus.REJECTED]: [],
};

export class QueueStateMachine {
  static canTransition(from: QueueStatus, to: QueueStatus): boolean {
    const allowedNext = VALID_QUEUE_TRANSITIONS[from];
    return allowedNext ? allowedNext.includes(to) : false;
  }

  static validateTransition(from: QueueStatus, to: QueueStatus): void {
    if (!this.canTransition(from, to)) {
      throw new BadRequestException(
        `Invalid queue transition: Cannot transition from '${from}' to '${to}'. Allowed next states: [${(VALID_QUEUE_TRANSITIONS[from] || []).join(', ')}]`,
      );
    }
  }

  static isRoleAuthorizedForTransition(role: Role, targetState: QueueStatus): boolean {
    // Admins have override privileges for exceptions and governance
    if (
      role === Role.SYSTEM_ADMIN ||
      role === Role.STATE_ADMIN ||
      role === Role.DISTRICT_ADMIN ||
      role === Role.CENTRE_ADMIN
    ) {
      return true;
    }

    switch (targetState) {
      case QueueStatus.CONFIRMED:
        return role === Role.FARMER || role === Role.CHECKIN_OPERATOR;

      case QueueStatus.ARRIVED:
        return role === Role.FARMER || role === Role.CHECKIN_OPERATOR;

      case QueueStatus.CHECKED_IN:
      case QueueStatus.WAITING:
        return role === Role.CHECKIN_OPERATOR;

      case QueueStatus.PROCESSING:
        return (
          role === Role.WEIGHING_OPERATOR ||
          role === Role.QUALITY_OPERATOR ||
          role === Role.PROCUREMENT_OPERATOR
        );

      case QueueStatus.COMPLETED:
        return role === Role.PROCUREMENT_OPERATOR;

      case QueueStatus.REJECTED:
        return (
          role === Role.CHECKIN_OPERATOR ||
          role === Role.QUALITY_OPERATOR
        );

      case QueueStatus.HELD:
        return (
          role === Role.QUALITY_OPERATOR ||
          role === Role.WEIGHING_OPERATOR
        );

      case QueueStatus.CANCELLED:
        return role === Role.FARMER;

      case QueueStatus.NO_SHOW:
        return role === Role.CHECKIN_OPERATOR;

      default:
        return false;
    }
  }

  static checkRoleAuthorization(role: Role, targetState: QueueStatus): void {
    if (!this.isRoleAuthorizedForTransition(role, targetState)) {
      throw new ForbiddenException(
        `Role '${role}' is not authorized to transition queue state to '${targetState}'.`,
      );
    }
  }
}
