const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Create a session fingerprint from User-Agent only.
 * IP is intentionally excluded — mobile users / proxies / NAT can change IP
 * mid-session and should NOT be logged out unexpectedly.
 */
const makeFingerprint = (req) => {
  const ua = req.headers?.['user-agent'] || '';
  const secret = process.env.JWT_SECRET || 'tuljabhavani_jwt_secret_key_2024';
  return crypto
    .createHash('sha256')
    .update(`${ua}::${secret}`)
    .digest('hex')
    .slice(0, 32);
};

/**
 * Generate a JWT token bound to the requesting browser session.
 * @param {object} payload   - { id, role }
 * @param {object} req       - Express request (for fingerprint)
 */
const generateToken = (payload, req) => {
  const fp = req ? makeFingerprint(req) : '';
  const secret = process.env.JWT_SECRET || 'tuljabhavani_jwt_secret_key_2024';
  return jwt.sign(
    { ...payload, fp },
    secret,
    { expiresIn: '24h', issuer: 'tuljabhavani-erp', audience: 'erp-client' }
  );
};

/**
 * Verify token AND validate fingerprint against current request.
 * Returns decoded payload on success, null on failure.
 * @param {string} token
 * @param {object} req - Express request (for fingerprint check)
 */
const verifyToken = (token, req) => {
  try {
    const secret = process.env.JWT_SECRET || 'tuljabhavani_jwt_secret_key_2024';
    const decoded = jwt.verify(token, secret, {
      issuer: 'tuljabhavani-erp',
      audience: 'erp-client'
    });
    // Fingerprint check: if token was issued with a fingerprint, validate it
    if (decoded.fp && req) {
      const expected = makeFingerprint(req);
      if (decoded.fp !== expected) {
        console.warn(`⚠️  Token fingerprint mismatch — possible session theft or cross-browser access`);
        return null;
      }
    }
    return decoded;
  } catch (err) {
    return null;
  }
};

module.exports = { generateToken, verifyToken, makeFingerprint };
