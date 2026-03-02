const test = require('node:test');
const assert = require('node:assert/strict');
const { generateTemporaryPassword, validateStrongPassword } = require('../utils/password');

test('validateStrongPassword rejects weak passwords', () => {
  const weakSamples = [
    'short1!',
    'alllowercase123!',
    'ALLUPPERCASE123!',
    'NoNumberPassword!',
    'NoSpecial12345',
  ];

  weakSamples.forEach((sample) => {
    assert.equal(validateStrongPassword(sample).ok, false);
  });
});

test('validateStrongPassword accepts strong passwords', () => {
  const result = validateStrongPassword('SaaSReady#2026');
  assert.equal(result.ok, true);
});

test('generateTemporaryPassword creates policy-compliant passwords', () => {
  const password = generateTemporaryPassword(16);
  assert.equal(password.length, 16);
  assert.equal(validateStrongPassword(password).ok, true);
});
