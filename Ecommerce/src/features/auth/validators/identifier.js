import { useState } from 'react';

// Mirrors the server (customerAuth.routes.js): an email, or an Indian mobile number (6-9 start, 10 digits) with an optional +91 / 91 / 0 prefix.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE = /^(?:\+?91|0)?[6-9]\d{9}$/;
const MAX_LENGTH = 254;

export const identifierError = value => {
  const text = value.trim();
  if (!text) return 'Enter your mobile number or email.';
  if (text.includes('@')) return EMAIL.test(text) && text.length <= MAX_LENGTH ? null : 'Enter a valid email address.';
  return MOBILE.test(text.replace(/[\s-]/g, '')) ? null : 'Enter a valid 10-digit mobile number.';
};

/** State for a mobile-or-email field: the error only shows once the shopper has left the field. */
export const useIdentifierField = () => {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const problem = identifierError(value);
  return {
    value,
    setValue,
    valid: !problem,
    error: touched && value.trim() ? problem : null,
    onBlur: () => setTouched(true),
  };
};
