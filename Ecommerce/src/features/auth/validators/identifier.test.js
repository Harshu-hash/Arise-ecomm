import { identifierError } from './identifier';

test('accepts emails and Indian mobile numbers', () => {
  for (const ok of ['9876543210', '+91 98765 43210', '919876543210', '09876543210', 'a.b@mail.com']) {
    expect(identifierError(ok)).toBeNull();
  }
});

test('rejects everything else, including long digit strings', () => {
  for (const bad of ['', '6859755878996978888888', '12345', '5876543210', 'abc', 'a@b', '98765 4321x']) {
    expect(identifierError(bad)).not.toBeNull();
  }
});
