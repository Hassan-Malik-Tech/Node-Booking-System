import { describe, expect, test } from '@jest/globals';
import AppError from '../../../src/errors/AppError.js';
import { getThrownError } from '../../helpers/getError.mjs';

describe('AppError', () => {
  describe('creates error with correct default shape', () => {
    test('when validation error is created', () => {
      const error = AppError.validation('Validation error');

      expect(error.message).toBe('Validation error');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    test('when bad request error is created', () => {
      const error = AppError.badRequest('Bad request');

      expect(error.message).toBe('Bad request');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.details).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    test('when unauthorized error is created', () => {
      const error = AppError.unauthorized('Unauthorized');

      expect(error.message).toBe('Unauthorized');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_CREDENTIALS');
      expect(error.details).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    test('when forbidden error is created', () => {
      const error = AppError.forbidden('Forbidden');

      expect(error.message).toBe('Forbidden');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.details).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    test('when too many requests error is created', () => {
      const error = AppError.tooManyRequests('Too many requests');

      expect(error.message).toBe('Too many requests');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('TOO_MANY_REQUESTS');
      expect(error.details).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    test('when not found error is created', () => {
      const error = AppError.notFound('Not found');

      expect(error.message).toBe('Not found');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.details).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    test('when conflict error is created', () => {
      const error = AppError.conflict('Conflict');

      expect(error.message).toBe('Conflict');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.details).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });
  });

  describe('creates error with correct shape when custom and optional fields are added', () => {
    test('to validation error', () => {
      const error = AppError.validation('Validation error', {
        code: 'CUSTOM_VALIDATION',
        details: [1, 2, 3],
        cause: 'cause',
      });

      expect(error.message).toBe('Validation error');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_VALIDATION');
      expect(error.details).toEqual([1, 2, 3]);
      expect(error.cause).toBe('cause');
    });

    test('to bad request error', () => {
      const error = AppError.badRequest('Bad request', {
        code: 'CUSTOM_BAD_REQUEST',
        details: [1, 2, 3],
        cause: 'cause',
      });

      expect(error.message).toBe('Bad request');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_BAD_REQUEST');
      expect(error.details).toEqual([1, 2, 3]);
      expect(error.cause).toBe('cause');
    });

    test('to unauthorized error', () => {
      const error = AppError.unauthorized('Unauthorized', {
        code: 'CUSTOM_UNAUTHORIZED',
        details: [1, 2, 3],
        cause: 'cause',
      });

      expect(error.message).toBe('Unauthorized');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('CUSTOM_UNAUTHORIZED');
      expect(error.details).toEqual([1, 2, 3]);
      expect(error.cause).toBe('cause');
    });

    test('to forbidden error', () => {
      const error = AppError.forbidden('Forbidden', {
        code: 'CUSTOM_FORBIDDEN',
        details: [1, 2, 3],
        cause: 'cause',
      });

      expect(error.message).toBe('Forbidden');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('CUSTOM_FORBIDDEN');
      expect(error.details).toEqual([1, 2, 3]);
      expect(error.cause).toBe('cause');
    });

    test('to too many requests error', () => {
      const error = AppError.tooManyRequests('Too many requests', {
        code: 'CUSTOM_TOO_MANY_REQUESTS',
        details: [1, 2, 3],
        cause: 'cause',
      });

      expect(error.message).toBe('Too many requests');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('CUSTOM_TOO_MANY_REQUESTS');
      expect(error.details).toEqual([1, 2, 3]);
      expect(error.cause).toBe('cause');
    });

    test('to not found error', () => {
      const error = AppError.notFound('Not found', {
        code: 'CUSTOM_NOT_FOUND',
        details: [1, 2, 3],
        cause: 'cause',
      });

      expect(error.message).toBe('Not found');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('CUSTOM_NOT_FOUND');
      expect(error.details).toEqual([1, 2, 3]);
      expect(error.cause).toBe('cause');
    });

    test('to conflict error', () => {
      const error = AppError.conflict('Conflict', {
        code: 'CUSTOM_CONFLICT',
        details: [1, 2, 3],
        cause: 'cause',
      });

      expect(error.message).toBe('Conflict');
      expect(error.name).toBe('AppError');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CUSTOM_CONFLICT');
      expect(error.details).toEqual([1, 2, 3]);
      expect(error.cause).toBe('cause');
    });
  });

  describe('checks for correct instance behavior', () => {
    test('on validation error', () => {
      const error = AppError.validation('validation error');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });

    test('on bad request error', () => {
      const error = AppError.badRequest('bad request');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });

    test('on unauthorized error', () => {
      const error = AppError.unauthorized('unauthorized');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });

    test('on forbidden error', () => {
      const error = AppError.forbidden('forbidden');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });

    test('on too many requests error', () => {
      const error = AppError.tooManyRequests('too many requests');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });

    test('on not found error', () => {
      const error = AppError.notFound('not found');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });

    test('on conflict error', () => {
      const error = AppError.conflict('conflict');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('throws TypeError', () => {
    test('when message is missing', () => {
      const error = getThrownError(() => new AppError());

      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toBe(
        'AppError message must be a non-empty string.',
      );
    });

    test('when message is an empty string', () => {
      const error = getThrownError(() => new AppError({ message: '' }));

      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toBe(
        'AppError message must be a non-empty string.',
      );
    });

    test('when message is not a string', () => {
      const error = getThrownError(() => new AppError({ message: 1 }));

      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toBe(
        'AppError message must be a non-empty string.',
      );
    });

    test('when message is only whitespace', () => {
      const error = getThrownError(() => new AppError({ message: '   ' }));

      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toBe(
        'AppError message must be a non-empty string.',
      );
    });
  });
});
