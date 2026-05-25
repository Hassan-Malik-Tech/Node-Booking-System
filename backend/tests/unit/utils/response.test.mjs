import { describe, expect, test } from '@jest/globals';
import { error, success } from '../../../src/utils/response.js';

const data = [1, 2, 3];
const code = 'CODE';
const message = 'message';

describe('response helpers', () => {
  describe('success', () => {
    test('returns success envelope with data', () => {
      expect(success({ data })).toEqual({ success: true, data });
    });

    test('returns success envelope with pagination when provided', () => {
      const pagination = {
        page: 1,
        pageSize: 10,
        total: 25,
        totalPages: 3,
      };

      expect(success({ data, pagination })).toEqual({
        success: true,
        data,
        pagination,
      });
    });
  });

  describe('error', () => {
    test('returns error envelope with code and message', () => {
      expect(error({ code, message })).toEqual({
        success: false,
        error: {
          code,
          message,
        },
      });
    });

    test('returns error envelope with details when provided', () => {
      const details = 'details';

      expect(error({ code, message, details })).toEqual({
        success: false,
        error: {
          code,
          message,
          details,
        },
      });
    });
  });
});
