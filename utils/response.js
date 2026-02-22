function error(message, code) {
  return { status: 'error', message, code };
}

function success(data) {
  return { status: 'success', data };
}

export { error, success };

// these are helper function to reduce repetition and to have consistent response envelops
