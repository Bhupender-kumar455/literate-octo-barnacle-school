require('dotenv').config();

const getRequiredEnv = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const validateJwtSecret = () => {
  const jwtSecret = getRequiredEnv('JWT_SECRET');

  if (jwtSecret === 'dev_secret_change_me') {
    throw new Error('Unsafe JWT_SECRET value detected. Set a strong unique secret.');
  }
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }

  return jwtSecret;
};

const JWT_SECRET = validateJwtSecret();

module.exports = {
  JWT_SECRET,
  getRequiredEnv,
};
