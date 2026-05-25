import { describe, expect, test } from '@jest/globals';
import extractBearerToken from '../../../src/auth/extractBearerToken.js';
import { getThrownError } from '../../helpers/getError.mjs';

describe('extractBearerToken', () => {
  describe('returns token', () => {
    test('when auth header shape is normal', () => {
      const authHeader = 'Bearer <token>';

      expect(extractBearerToken(authHeader)).toBe('<token>');
    });

    test('when bearer scheme is lowercase', () => {
      const authHeader = 'bearer <token>';

      expect(extractBearerToken(authHeader)).toBe('<token>');
    });

    test('when bearer scheme is uppercase', () => {
      const authHeader = 'BEARER <token>';

      expect(extractBearerToken(authHeader)).toBe('<token>');
    });

    test('when auth header has extra whitespace', () => {
      const authHeader = 'Bearer        <token>';

      expect(extractBearerToken(authHeader)).toBe('<token>');
    });
  });

  describe('throws correct error shape', () => {
    test('when there is no auth header passed to the function', () => {
      const error = getThrownError(() => extractBearerToken());

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('when auth header does not use bearer scheme', () => {
      const error = getThrownError(() => extractBearerToken('Bad token'));

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_AUTHORIZATION_HEADER');
    });

    test('when auth header does not have exactly two parts', () => {
      const error = getThrownError(() => extractBearerToken('Bearer'));

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_AUTHORIZATION_HEADER');
    });

    test('when auth header has too many parts', () => {
      const error = getThrownError(() =>
        extractBearerToken('Bearer token extra'),
      );

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_AUTHORIZATION_HEADER');
    });

    test('when auth header is not a string', () => {
      const error = getThrownError(() => extractBearerToken(2));

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_AUTHORIZATION_HEADER');
    });
  });
});
