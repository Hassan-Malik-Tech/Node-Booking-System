import { SignJWT, jwtVerify } from 'jose';
import config from '../config/index.js';
import AppError from '../errors/AppError.js';
import ERROR_CODES from '../errors/errorCodes.js';
import { invalidTokenError } from '../errors/commonErrors.js';

// converts secret into bytes as jose needs byte key material for signing and verifying tokens.
const jwtSecret = new TextEncoder().encode(config.jwt.secret);

const JWT_ALGORITHM = 'HS256';

export function signAccessToken(user) {
  return (
    new SignJWT({
      // custom
      tokenVersion: user.token_version,
    })
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .setSubject(String(user.id))
      // can put a value like new Date() but it automatically issues the time without a value
      .setIssuedAt()
      .setExpirationTime(config.jwt.expiresIn)
      .sign(jwtSecret)
  );
}

export async function verifyAccessToken(token) {
  try {
    // The payload returned is the payload with sub, tokenVersion, iat and exp
    const { payload } = await jwtVerify(token, jwtSecret, {
      algorithms: [JWT_ALGORITHM],
    });

    return payload;
  } catch (error) {
    throw invalidTokenError();
  }
}

// jwtVerify verifies the token signature, expiration, and JWT-level validity.
// These checks validate the app-specific payload shape before trusting it as req.auth.
// This is defensive in case the token format changes, old tokens exist, or a signing bug creates invalid claims.

export function buildAuthContext(payload) {
  const userId = Number(payload.sub);
  const tokenVersion = payload.tokenVersion;

  if (!Number.isInteger(tokenVersion) || tokenVersion < 0) {
    throw invalidTokenError();
  }

  if (!Number.isInteger(userId) || userId <= 0) {
    throw invalidTokenError();
  }

  // used for req.auth
  return {
    userId,
    tokenVersion,
  };
}
