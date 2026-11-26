import assert from 'node:assert/strict';
import test from 'node:test';
import { staticPageBody } from '../src/modules/admin/presentation/cms.routes.js';

test('static page links accept only optional http and https URLs', () => {
  const base = { body: 'About Arise', materialChange: false };
  assert.equal(staticPageBody.safeParse(base).success, true);
  assert.equal(staticPageBody.safeParse({ ...base, links: { website: 'https://arise.example', careers: null, press: null, social: null } }).success, true);
  for (const website of ['javascript:alert(1)', 'mailto:team@arise.example', 'not-a-url']) {
    assert.equal(staticPageBody.safeParse({ ...base, links: { website, careers: null, press: null, social: null } }).success, false);
  }
});
