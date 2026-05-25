import { describe, expect, test } from '@jest/globals';
import deriveExpiresInSeconds from '../../../src/config/deriveExpiresInSeconds.js';

describe('deriveExpiresInSeconds', () => {
  describe('converts', () => {
    test('seconds string to integer', () => {
      expect(deriveExpiresInSeconds('8s')).toBe(8);
    });

    test('minutes to seconds', () => {
      expect(deriveExpiresInSeconds('8m')).toBe(480);
    });

    test('hours to seconds', () => {
      expect(deriveExpiresInSeconds('8h')).toBe(28800);
    });

    test('days to seconds', () => {
      expect(deriveExpiresInSeconds('8d')).toBe(691200);
    });
  });

  describe('throws', () => {
    test('when the unit is unsupported', () => {
      expect(() => deriveExpiresInSeconds('8w')).toThrow(
        'JWT_EXPIRES_IN must match format like 10s, 15m, 1h, or 7d.',
      );
    });

    test('when the value is not a string', () => {
      expect(() => deriveExpiresInSeconds(8)).toThrow(
        'JWT_EXPIRES_IN must match format like 10s, 15m, 1h, or 7d.',
      );
    });
  });
});
