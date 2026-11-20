import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { catalogChanged, notifyCatalogOnWrite, onCatalogChange } from '../src/infrastructure/realtime/catalogEvents.js';

test('successful writes clear catalog caches; reads and failed writes do not', () => {
  let cleared = 0;
  onCatalogChange(() => { cleared += 1; });
  const run = (method, statusCode) => {
    const res = Object.assign(new EventEmitter(), { statusCode });
    notifyCatalogOnWrite({ method }, res, () => {});
    res.emit('finish');
  };
  run('GET', 200);
  run('POST', 422);
  assert.equal(cleared, 0);
  run('PATCH', 200);
  run('DELETE', 204);
  assert.equal(cleared, 2);
  catalogChanged();
  assert.equal(cleared, 3);
});
