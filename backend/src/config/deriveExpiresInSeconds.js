function deriveExpiresInSeconds(expiresIn) {
  // Not strictly needed, but a defensive gaurd
  if (typeof expiresIn !== 'string') {
    throw new Error(
      'JWT_EXPIRES_IN must match format like 10s, 15m, 1h, or 7d.',
    );
  }

  const match = expiresIn.match(/^(\d+)([smhd])$/);

  if (!match) {
    throw new Error(
      'JWT_EXPIRES_IN must match format like 10s, 15m, 1h, or 7d.',
    );
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === 's') {
    return amount;
  }

  if (unit === 'm') {
    return amount * 60;
  }

  if (unit === 'h') {
    return amount * 60 * 60;
  }

  if (unit === 'd') {
    return amount * 24 * 60 * 60;
  }
}

export default deriveExpiresInSeconds;
