const missingResource = 'NOT_FOUND';
const invalidJson = 'INVALID_JSON'
const internalErr = 'INTERNAL_ERROR'
const badReq = 'BAD_REQUEST'
const wrongMediaType = 'UNSUPPORTED_MEDIA_TYPE';

export { missingResource, internalErr, badReq, invalidJson, wrongMediaType };

// used to avoid hard coding the error codes.
// this way I can avoid inconsistent error codes, and accidental miss spelling