import extractBearerToken from '../auth/extractBearerToken.js';
import { verifyAccessToken, buildAuthContext } from '../auth/authToken.js';

async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req.get('Authorization'));
    const tokenPayload = await verifyAccessToken(token);

    req.auth = buildAuthContext(tokenPayload);

    return next();
  } catch (error) {
    return next(error);
  }
}

export default requireAuth;
