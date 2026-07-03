import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRES_IN = '7d';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is missing from environment variables.');
  }

  return secret;
};

const generateToken = (payload, options = {}) => {
  const { expiresIn, ...signOptions } = options;

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
    ...signOptions
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

export { generateToken, verifyToken };