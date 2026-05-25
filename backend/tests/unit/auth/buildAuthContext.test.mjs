import { describe, expect, test } from '@jest/globals';
import { buildAuthContext } from '../../../src/auth/authToken.js';
import { getThrownError } from '../../helpers/getError.mjs';

describe('buildAuthContext', () => {
  describe('returns auth context', () => {
    test('when payload has user role', () => {
      const authContext = buildAuthContext({ sub: '1', role: 'user' });

      expect(authContext).toEqual({ userId: 1, role: 'user' });
    });

    test('when payload has employee role', () => {
      const authContext = buildAuthContext({ sub: '1', role: 'employee' });

      expect(authContext).toEqual({ userId: 1, role: 'employee' });
    });

    test('when payload has admin role', () => {
      const authContext = buildAuthContext({ sub: '1', role: 'admin' });

      expect(authContext).toEqual({ userId: 1, role: 'admin' });
    });

    test('when sub is an integer', () => {
      const authContext = buildAuthContext({ sub: 1, role: 'admin' });

      expect(authContext).toEqual({ userId: 1, role: 'admin' });
    });
  });

  describe('throws correct error shape', () => {
    test('when sub is missing', () => {
      const error = getThrownError(() => buildAuthContext({ role: 'user' }));

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when sub is not numeric', () => {
      const error = getThrownError(() =>
        buildAuthContext({ sub: 'string', role: 'user' }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when sub is zero', () => {
      const error = getThrownError(() =>
        buildAuthContext({ sub: '0', role: 'user' }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when sub is negative', () => {
      const error = getThrownError(() =>
        buildAuthContext({ sub: '-1', role: 'user' }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when sub is a decimal number', () => {
      const error = getThrownError(() =>
        buildAuthContext({ sub: '1.5', role: 'user' }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when sub is an empty string', () => {
      const error = getThrownError(() =>
        buildAuthContext({ sub: '', role: 'user' }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when role is missing', () => {
      const error = getThrownError(() => buildAuthContext({ sub: '1' }));

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when role casing is invalid', () => {
      const error = getThrownError(() =>
        buildAuthContext({ sub: '1', role: 'Admin' }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when role is invalid', () => {
      const error = getThrownError(() =>
        buildAuthContext({ sub: '1', role: 'invalid' }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });
  });
});
