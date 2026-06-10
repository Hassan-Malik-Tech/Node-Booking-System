import { TEST_PASSWORD } from './testConstants.mjs';
import {
  generateRandomUsername,
  generateRandomEmail,
  generateRandomResourceName,
} from './generateRandomData.mjs';

export function buildRegisterRequestBody(overrides = {}) {
  return {
    username: generateRandomUsername(),
    password: TEST_PASSWORD,
    name: 'test name',
    email: generateRandomEmail(),
    ...overrides,
  };
}

// For some reason the JSON response from express
// sends '2036-01-01T09:00:00.000Z'
// even if i send '2036-01-01T09:00:00Z'
export function buildCreateAvailabilityWindowRequestBody(overrides = {}) {
  return {
    startTime: '2036-01-01T09:00:00.000Z',
    endTime: '2036-01-01T17:00:00.000Z',
    cancellationNoticeMinutes: 60,
    allowedDurations: [30, 60],
    ...overrides,
  };
}

export function buildCreateAvailabilityWindowsBulkRequestBody({
  firstWindowOverrides = {},
  secondWindowOverrides = {},
} = {}) {
  return [
    {
      startTime: '2036-01-01T09:00:00.000Z',
      endTime: '2036-01-01T17:00:00.000Z',
      cancellationNoticeMinutes: 90,
      allowedDurations: [30, 60],
      ...firstWindowOverrides,
    },
    {
      startTime: '2036-01-02T09:00:00.000Z',
      endTime: '2036-01-02T17:00:00.000Z',
      cancellationNoticeMinutes: 60,
      allowedDurations: [45, 60],
      ...secondWindowOverrides,
    },
  ];
}

export function buildCreateResourceRequestBody({
  firstWindowOverrides = {},
  secondWindowOverrides = {},
  ...resourceDataOverrides
} = {}) {
  const createResourceReqBody = {
    resourceData: {
      name: generateRandomResourceName(),
      description: 'Test resource description',
      capacity: 10,
      isActive: true,
      ...resourceDataOverrides,
    },
  };

  if (createResourceReqBody.resourceData.isActive === true) {
    createResourceReqBody.availabilityWindowDataList =
      buildCreateAvailabilityWindowsBulkRequestBody({
        firstWindowOverrides,
        secondWindowOverrides,
      });
  }

  return createResourceReqBody;
}
