import {
  afterAll,
  describe,
  expect,
  test,
  beforeEach,
} from '@jest/globals';
import request from 'supertest';
import app from '../../../../src/app.js';
import {
  rebuildTestDb,
  closeTestDbPool,
} from '../../../helpers/rebuildTestDb.mjs';
import { expectValidationErrorResponse } from '../../../helpers/assertions.mjs';
import { createTestResource } from '../../../helpers/createTestData.mjs';
import { generateRandomId } from '../../../helpers/generateRandomData.mjs';
import { softDeleteResourceById } from '../../../../src/data-access/resources.js';
import { wait } from '../../../helpers/asyncHelpers.mjs';

beforeEach(async () => {
  await rebuildTestDb();
});

afterAll(async () => {
  await closeTestDbPool();
});

describe('/api/resources', () => {
  describe('GET /', () => {
    describe('happy path', () => {
      test('returns 200 with correct response and default pagination shape', async () => {
        const [r1, r2] = await Promise.all([
          createTestResource(),
          createTestResource(),
        ]);

        const response = await request(app).get('/api/resources');

        expect(response.status).toBe(200);

        //pg returns timestamps as JavaScript Date objects.
        // Express JSON responses serialize Date objects into ISO strings.
        // So toISOString() is used because the API returns a string, not a Date object.
        expect(response.body).toEqual({
          success: true,
          data: expect.arrayContaining([
            {
              id: r1.id,
              ownerId: r1.owner_id,
              name: r1.name,
              description: r1.description,
              capacity: r1.capacity,
              createdAt: r1.created_at.toISOString(),
              updatedAt: r1.updated_at.toISOString(),
            },
            {
              id: r2.id,
              ownerId: r2.owner_id,
              name: r2.name,
              description: r2.description,
              capacity: r2.capacity,
              createdAt: r2.created_at.toISOString(),
              updatedAt: r2.updated_at.toISOString(),
            },
          ]),
          pagination: {
            page: 1,
            pageSize: 10,
            total: 2,
            totalPages: 1,
          },
        });
        expect(response.body.data).toHaveLength(2);
      });

      test('returns the requested page and page size', async () => {
        await Promise.all([
          createTestResource(),
          createTestResource(),
          createTestResource(),
          createTestResource(),
        ]);

        const firstPageResponse = await request(app)
          .get('/api/resources')
          .query({ page: 1, pageSize: 2 });

        const secondPageResponse = await request(app)
          .get('/api/resources')
          .query({ page: 2, pageSize: 2 });

        expect(firstPageResponse.status).toBe(200);
        expect(secondPageResponse.status).toBe(200);

        // This proves that each page has the right number of items.
        expect(firstPageResponse.body.data).toHaveLength(2);
        expect(secondPageResponse.body.data).toHaveLength(2);

        // This proves that it sends the correct pagination shape
        // for both pages.
        expect(firstPageResponse.body.pagination).toEqual({
          page: 1,
          pageSize: 2,
          total: 4,
          totalPages: 2,
        });

        expect(secondPageResponse.body.pagination).toEqual({
          page: 2,
          pageSize: 2,
          total: 4,
          totalPages: 2,
        });
      });

      test('returns active resources sorted by createdAt desc by default', async () => {
        await createTestResource();
        await wait(10);

        await createTestResource();
        await wait(10);

        await createTestResource();

        const response = await request(app).get('/api/resources');

        expect(response.status).toBe(200);

        // Date.parse('2026-05-28T18:25:07.419Z') turns it into a number 1780002307419.
        // This number is the number of ms since jan 1 1970 utc.
        // This parses all the createdAt values into ms and puts it into an array.
        const createdAtMsArr = response.body.data.map((resource) =>
          Date.parse(resource.createdAt),
        );

        // Sorts in decending order (so createdAt in desc) (b - a is desc)
        // and makes a copy of createdAtValues since sorting
        // mutates the original array.
        const descCreatedAtMsArr = [...createdAtMsArr].sort((a, b) => b - a);

        // This proves that the original createdAt values was descending
        // since it equals the descending sorted createdAt array.
        expect(createdAtMsArr).toEqual(descCreatedAtMsArr);
      });

      // The test above already proves that desc order works and the default behaviour
      // sord by createdAt works, this proves the other option.
      test('returns resources sorted by name asc', async () => {
        await Promise.all([
          createTestResource(),
          createTestResource(),
          createTestResource(),
        ]);

        const response = await request(app)
          .get('/api/resources')
          .query({ sortBy: 'name', sortDirection: 'asc' });

        expect(response.status).toBe(200);

        const namesArr = response.body.data.map((resource) => resource.name);

        // a - b sorts numeric values because the - operator (-) converts both sides to numbers (This is a js feature 10 - 2 is the same as "10" - "2").
        // That also works for numeric strings like '10' and '2'.
        // Resource names are normal strings, so a - b would return NaN.
        // Use localeCompare for alphabetical sorting.
        const ascNamesArr = [...namesArr].sort((a, b) => a.localeCompare(b));

        expect(namesArr).toEqual(ascNamesArr);
      });

      test('returns resources matching search by name', async () => {
        const [resource] = await Promise.all([
          createTestResource(),
          createTestResource(),
        ]);

        const { name } = resource;

        const response = await request(app)
          .get('/api/resources')
          .query({ search: name });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.pagination.total).toBe(1);
        expect(response.body.data[0].name).toBe(name);
      });

      test('returns resources matching search by description', async () => {
        const description = `description ${generateRandomId()}`;

        await Promise.all([
          createTestResource({ description }),
          createTestResource(),
        ]);

        const response = await request(app)
          .get('/api/resources')
          .query({ search: description });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.pagination.total).toBe(1);
        expect(response.body.data[0].description).toBe(description);
      });

      test('returns empty data when search has no matches', async () => {
        await Promise.all([createTestResource(), createTestResource()]);

        const randomSearch = `search ${generateRandomId()}`;

        const response = await request(app)
          .get('/api/resources')
          .query({ search: randomSearch });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(0);
        expect(response.body.pagination.total).toBe(0);
      });

      test('does not return inactive or soft deleted resources', async () => {
        const [resourceToDelete] = await Promise.all([
          createTestResource(),
          createTestResource({ isActive: false }),
        ]);

        await softDeleteResourceById({ resourceId: resourceToDelete.id });

        const response = await request(app).get('/api/resources');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          data: [],
          pagination: {
            page: 1,
            pageSize: 10,
            total: 0,
            totalPages: 0,
          },
        });
      });
    });

    describe('unhappy path', () => {
      describe('returns 400 VALIDATION_ERROR with correct response', () => {
        test('for invalid page', async () => {
          const response = await request(app)
            .get('/api/resources')
            .query({ page: 0 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource list query.',
            field: 'page',
            detailsMessage: 'Page must be at least 1.',
          });
        });

        test('for invalid pageSize', async () => {
          const response = await request(app)
            .get('/api/resources')
            .query({ pageSize: 101 });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource list query.',
            field: 'pageSize',
            detailsMessage: 'Page size must be at most 100.',
          });
        });

        test('for invalid sortBy', async () => {
          const response = await request(app)
            .get('/api/resources')
            .query({ sortBy: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource list query.',
            field: 'sortBy',
            detailsMessage: 'Sort by must be either createdAt or name.',
          });
        });

        test('for invalid sortDirection', async () => {
          const response = await request(app)
            .get('/api/resources')
            .query({ sortDirection: 'invalid' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource list query.',
            field: 'sortDirection',
            detailsMessage: 'Sort direction must be either asc or desc.',
          });
        });

        test('for empty search', async () => {
          const response = await request(app)
            .get('/api/resources')
            .query({ search: '' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource list query.',
            field: 'search',
            detailsMessage: 'Search cannot be empty.',
          });
        });

        test('for unknown query param', async () => {
          const response = await request(app)
            .get('/api/resources')
            .query({ unknown: 'unknown' });

          expectValidationErrorResponse({
            response,
            errorMessage: 'Invalid resource list query.',
            field: 'unknown',
            detailsMessage: '"unknown" is not allowed', // joi default message
          });
        });
      });
    });
  });
});
