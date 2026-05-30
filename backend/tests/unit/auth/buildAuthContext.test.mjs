import { describe, expect, test } from '@jest/globals';
import { buildAuthContext } from '../../../src/auth/authToken.js';
import { getThrownError } from '../../helpers/getError.mjs';

describe('buildAuthContext', () => {
  describe('returns auth context', () => {
    test('when payload has user role', () => {
      const authContext = buildAuthContext({
        sub: '1',
        role: 'user',
        tokenVersion: 0,
      });

      expect(authContext).toEqual({
        userId: 1,
        role: 'user',
        tokenVersion: 0,
      });
    });

    test('when payload has employee role', () => {
      const authContext = buildAuthContext({
        sub: '1',
        role: 'employee',
        tokenVersion: 0,
      });

      expect(authContext).toEqual({
        userId: 1,
        role: 'employee',
        tokenVersion: 0,
      });
    });

    test('when payload has admin role', () => {
      const authContext = buildAuthContext({
        sub: '1',
        role: 'admin',
        tokenVersion: 0,
      });

      expect(authContext).toEqual({
        userId: 1,
        role: 'admin',
        tokenVersion: 0,
      });
    });

    test('when sub is an integer', () => {
      const authContext = buildAuthContext({
        sub: 1,
        role: 'admin',
        tokenVersion: 0,
      });

      expect(authContext).toEqual({
        userId: 1,
        role: 'admin',
        tokenVersion: 0,
      });
    });
  });

  describe('throws correct error shape', () => {
    test('when sub is missing', () => {
      const error = getThrownError(() =>
        buildAuthContext({ role: 'user', tokenVersion: 0 }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when sub is not numeric', () => {
      const error = getThrownError(() =>
        buildAuthContext({
          sub: 'string',
          role: 'user',
          tokenVersion: 0,
        }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when sub is zero', () => {
      const error = getThrownError(() =>
        buildAuthContext({
          sub: '0',
          role: 'user',
          tokenVersion: 0,
        }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when sub is negative', () => {
      const error = getThrownError(() =>
        buildAuthContext({
          sub: '-1',
          role: 'user',
          tokenVersion: 0,
        }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when sub is a decimal number', () => {
      const error = getThrownError(() =>
        buildAuthContext({
          sub: '1.5',
          role: 'user',
          tokenVersion: 0,
        }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when sub is an empty string', () => {
      const error = getThrownError(() =>
        buildAuthContext({
          sub: '',
          role: 'user',
          tokenVersion: 0,
        }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when role is missing', () => {
      const error = getThrownError(() =>
        buildAuthContext({ sub: '1', tokenVersion: 0 }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when role casing is invalid', () => {
      const error = getThrownError(() =>
        buildAuthContext({
          sub: '1',
          role: 'Admin',
          tokenVersion: 0,
        }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when role is invalid', () => {
      const error = getThrownError(() =>
        buildAuthContext({
          sub: '1',
          role: 'invalid',
          tokenVersion: 0,
        }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when tokenVersion is missing', () => {
      const error = getThrownError(() =>
        buildAuthContext({ sub: '1', role: 'user' }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when tokenVersion is not a number', () => {
      const error = getThrownError(() =>
        buildAuthContext({
          sub: '1',
          role: 'user',
          tokenVersion: '0',
        }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when tokenVersion is negative', () => {
      const error = getThrownError(() =>
        buildAuthContext({
          sub: '1',
          role: 'user',
          tokenVersion: -1,
        }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });

    test('when tokenVersion is a decimal number', () => {
      const error = getThrownError(() =>
        buildAuthContext({
          sub: '1',
          role: 'user',
          tokenVersion: 1.5,
        }),
      );

      expect(error.message).toBe('Invalid or expired token.');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });
  });
});
