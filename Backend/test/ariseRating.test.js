import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { ariseRatingBody } from '../src/modules/support/presentation/ariseRating.routes.js';

test('Arise rating accepts only whole stars from one to five', () => {
  assert.deepEqual(ariseRatingBody.parse({ rating: 5 }), { rating: 5 });
  for (const rating of [0, 1.5, 6, '5']) {
    assert.equal(ariseRatingBody.safeParse({ rating }).success, false);
  }
});

test('Arise rating endpoint requires a customer', async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/v1/arise-ratings`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rating: 5 }),
  });
  assert.equal(response.status, 401);
});
