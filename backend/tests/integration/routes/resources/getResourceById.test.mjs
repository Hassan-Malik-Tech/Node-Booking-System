import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import { createTestResource } from '../../../helpers/createTestData.mjs';
import {
  expectResourceNotFoundResponse,
  expectValidationErrorResponse,
} from '../../../helpers/assertions.mjs';
import { softDeleteResourceById } from '../../../../src/data-access/resources.js';

beforeAll(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('GET /:resourceId', () => {
    describe('happy path', () => {
      test('returns 200 with correct response shape', async () => {
        const resource = await createTestResource();

        const response = await request(app).get(
          `/api/resources/${resource.id}`,
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: {
            id: resource.id,
            ownerId: resource.owner_id,
            name: resource.name,
            description: resource.description,
            capacity: resource.capacity,
            isActive: resource.is_active,
            createdAt: resource.created_at.toISOString(),
            updatedAt: resource.updated_at.toISOString(),
          },
        });
      });
    });

    describe('unhappy path', () => {
      describe('returns 404 RESOURCE_NOT_FOUND with correct response', () => {
        test('when resource does not exist', async () => {
          const response = await request(app).get('/api/resources/999999');

          expectResourceNotFoundResponse(response);
        });

        test('when resource is inactive', async () => {
          const resource = await createTestResource({ isActive: false });

          const response = await request(app).get(
            `/api/resources/${resource.id}`,
          );

          expectResourceNotFoundResponse(response);
        });

        // To test if my soft delete logic is correct.
        test('when resource is soft deleted', async () => {
          const resource = await createTestResource();

          await softDeleteResourceById(resource.id);

          const response = await request(app).get(
            `/api/resources/${resource.id}`,
          );

          expectResourceNotFoundResponse(response);
        });
      });

      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for resource id that is not a number', async () => {
          const response = await request(app).get(
            '/api/resources/not-a-number',
          );

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource id parameter.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be a number.',
          });
        });

        test('for resource id that is not an integer', async () => {
          const response = await request(app).get('/api/resources/1.5');

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource id parameter.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be an integer.',
          });
        });

        test('for resource id less than 1', async () => {
          const response = await request(app).get('/api/resources/0');

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource id parameter.',
            field: 'resourceId',
            detailsMessage: 'Resource id must be at least 1.',
          });
        });
      });
    });
  });
});
