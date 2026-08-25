/**
 * Re-exported from `@devos/domain` (moved there while fixing a circular
 * dependency DEVOS-057 introduced) so every existing import of these
 * classes from `@devos/application` continues to work unchanged.
 */
export { ApplicationError, ForbiddenError, NotFoundError, ValidationError } from '@devos/domain';
