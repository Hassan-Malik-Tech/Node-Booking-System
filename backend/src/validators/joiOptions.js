export const strictValidationOptions = {
  abortEarly: false,
  allowUnknown: false,
  stripUnknown: false,
  convert: true,
};

export const headerValidationOptions = {
  abortEarly: false,
  // Real requests include many headers this backend is not validating, so unknown headers should not cause validation failure.
  allowUnknown: true,
  // Remove unknown header keys from the returned validated value so only schema-defined headers are used.
  stripUnknown: true,
  convert: true,
};

// abortEarly: true stops at the first error, it is better to send every error to the client not just the first
