const crypto = require('crypto');

const PASSWORD_POLICY = {
  minLength: 12,
  requiresUpper: true,
  requiresLower: true,
  requiresNumber: true,
  requiresSpecial: true,
};

const validateStrongPassword = (password) => {
  const value = String(password || '');
  if (value.length < PASSWORD_POLICY.minLength) {
    return {
      ok: false,
      message: `Password must be at least ${PASSWORD_POLICY.minLength} characters long.`,
    };
  }
  if (PASSWORD_POLICY.requiresUpper && !/[A-Z]/.test(value)) {
    return { ok: false, message: 'Password must include at least one uppercase letter.' };
  }
  if (PASSWORD_POLICY.requiresLower && !/[a-z]/.test(value)) {
    return { ok: false, message: 'Password must include at least one lowercase letter.' };
  }
  if (PASSWORD_POLICY.requiresNumber && !/[0-9]/.test(value)) {
    return { ok: false, message: 'Password must include at least one number.' };
  }
  if (PASSWORD_POLICY.requiresSpecial && !/[^A-Za-z0-9]/.test(value)) {
    return { ok: false, message: 'Password must include at least one special character.' };
  }
  return { ok: true, message: '' };
};

const generateTemporaryPassword = (length = 16) => {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const specials = '!@#$%^&*()-_=+[]{}';
  const all = `${uppercase}${lowercase}${numbers}${specials}`;

  const pick = (charset) => charset[crypto.randomInt(0, charset.length)];
  const base = [
    pick(uppercase),
    pick(lowercase),
    pick(numbers),
    pick(specials),
  ];

  while (base.length < Math.max(length, 12)) {
    base.push(pick(all));
  }

  for (let i = base.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }

  return base.join('');
};

module.exports = {
  PASSWORD_POLICY,
  validateStrongPassword,
  generateTemporaryPassword,
};
