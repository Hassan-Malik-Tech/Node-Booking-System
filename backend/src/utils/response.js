function error({ code, message, details }) {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    response.error.details = details;
  }

  return response;
}

function success({ data, pagination }) {
  const response = { success: true, data };

  if (pagination !== undefined) {
    response.pagination = pagination;
  }

  return response;
}

export { error, success };

// These are helper function to reduce repetition and to have consistent response envelops
