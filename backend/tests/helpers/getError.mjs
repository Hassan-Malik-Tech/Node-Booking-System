export function getThrownError(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }

  throw new Error('Expected function to throw.');
}

export async function getRejectedError(fn) {
  try {
    await fn();
  } catch (error) {
    return error;
  }

  throw new Error('Expected async function to reject.');
}

/*
Without these functions (manual version):

  let error;

  try {
    extractBearerToken(undefined);
  } catch (caughtError) {
    error = caughtError;
  }

  expect(error.statusCode).toBe(401);
  expect(error.code).toBe('AUTHENTICATION_REQUIRED');
});

*/
