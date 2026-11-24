// Live chat: customer <-> support over HTTP against a real MongoDB (set TEST_MONGODB_URI).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import mongoose from 'mongoose';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISABLE_INFRASTRUCTURE: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-chat-')),
});
process.on('exit', () => rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

const uri = process.env.TEST_MONGODB_URI;
const opts = { skip: !uri && 'set TEST_MONGODB_URI to run' };

before(async () => { if (uri) await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true }); });
after(async () => {
  if (uri) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('live chat: customer starts a chat, agent replies, closing ends it, permissions hold', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  await User.init();

  const server = createServer(createApp()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const customer = await User.create({ role: 'CUSTOMER', name: 'Asha Rao', email: 'asha@arise.test', passwordHash: 'x', status: 'ACTIVE' });
  const admin = await User.create({ role: 'ADMIN', email: 'agent@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['support.chat.handle'] });
  const agent2 = await User.create({ role: 'ADMIN', name: 'Meera', email: 'meera@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['support.chat.handle'] });
  const otherAdmin = await User.create({ role: 'ADMIN', email: 'other@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: [] });
  const call = async (token, method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const asCustomer = (...args) => call(signAccessToken({ sub: String(customer._id), role: 'CUSTOMER' }), ...args);
  const asAdmin = (...args) => call(signAccessToken({ sub: String(admin._id), role: 'ADMIN' }), ...args);

  // channels are public and come from Settings; chat needs a signed-in customer
  const channels = (await call(null, 'GET', '/customer/v1/support/channels')).body.data;
  assert.deepEqual(channels.channels.map((channel) => channel.type), ['CHAT', 'PHONE', 'EMAIL']);
  assert.equal((await call(null, 'GET', '/customer/v1/support/chat')).status, 401);

  // no chat yet -> null; first message opens one; blank text is rejected
  assert.equal((await asCustomer('GET', '/customer/v1/support/chat')).body.data, null);
  assert.equal((await asCustomer('POST', '/customer/v1/support/chat/messages', { body: '   ' })).status, 422);
  const first = (await asCustomer('POST', '/customer/v1/support/chat/messages', { body: 'Where is my order?' })).body.data;
  assert.deepEqual([first.status, first.messages.length, first.messages[0].authorType], ['OPEN', 1, 'CUSTOMER']);
  assert.equal((await asCustomer('POST', '/customer/v1/support/chat/messages', { body: 'Hello?' })).body.data.id, first.id, 'one open chat per customer');

  // the agent inbox: needs support.chat.handle, shows the chat waiting
  assert.equal((await call(signAccessToken({ sub: String(otherAdmin._id), role: 'ADMIN' }), 'GET', '/admin/v1/chats')).status, 403);
  assert.equal((await call(signAccessToken({ sub: String(customer._id), role: 'CUSTOMER' }), 'GET', '/admin/v1/chats')).status, 403);
  const inbox = (await asAdmin('GET', '/admin/v1/chats')).body.data;
  assert.deepEqual([inbox.length, inbox[0].customerName, inbox[0].waitingForAgent, inbox[0].lastMessagePreview], [1, 'Asha Rao', true, 'Hello?']);

  // the agent replies: customer sees it as "Arise Support", chat is no longer waiting
  const replied = (await asAdmin('POST', `/admin/v1/chats/${first.id}/messages`, { body: 'Let me check.' })).body.data;
  assert.equal(replied.waitingForAgent, false);
  const mine = (await asCustomer('GET', '/customer/v1/support/chat')).body.data;
  assert.deepEqual(mine.messages.map((message) => message.authorDisplayName), ['You', 'You', 'Arise Support']);

  // unread counts: the customer has 1 unread agent reply until they open the chat
  assert.equal(mine.unreadCount, 1);
  assert.equal((await asCustomer('POST', '/customer/v1/support/chat/read')).body.data.unreadCount, 0);

  // photos: only the sender's own private chat files; a photo alone is a message; at most three
  const uuid = (n) => `0b0c0d0e-0000-4000-8000-00000000000${n}`;
  const photo = `private/chat/${customer._id}/${uuid(1)}.jpg`;
  const adminsPhoto = `private/chat/${admin._id}/${uuid(1)}.jpg`;
  assert.equal((await asCustomer('POST', '/customer/v1/support/chat/messages', { attachments: [adminsPhoto] })).body.error.code, 'ATTACHMENT_INVALID');
  assert.equal((await asCustomer('POST', '/customer/v1/support/chat/messages', { attachments: [1, 2, 3, 4].map((n) => photo.replace(uuid(1), uuid(n))) })).status, 422);
  const withPhoto = (await asCustomer('POST', '/customer/v1/support/chat/messages', { attachments: [photo] })).body.data;
  assert.match(withPhoto.messages.at(-1).attachments[0].url, /token=/);
  assert.equal((await asAdmin('GET', '/admin/v1/chats')).body.data[0].lastMessagePreview, 'Photo');

  // the agent's unread: 3 customer messages so far, zero once an agent opens the chat
  assert.equal((await asAdmin('GET', '/admin/v1/chats')).body.data[0].unreadCount, 3);
  assert.equal((await asAdmin('POST', `/admin/v1/chats/${first.id}/read`)).body.data.unreadCount, 0);

  // transfer: only agents who handle chats can receive it; the note is internal
  assert.deepEqual((await asAdmin('GET', '/admin/v1/chats/agents')).body.data.map((agent) => agent.name).sort(), ['Meera', 'agent@arise.test']);
  assert.equal((await asAdmin('POST', `/admin/v1/chats/${first.id}/transfer`, { agentId: String(otherAdmin._id) })).status, 422);
  const moved = (await asAdmin('POST', `/admin/v1/chats/${first.id}/transfer`, { agentId: String(agent2._id) })).body.data;
  assert.deepEqual([moved.agentName, moved.messages.at(-1).authorType], ['Meera', 'SYSTEM']);
  assert.equal((await asCustomer('GET', '/customer/v1/support/chat')).body.data.messages.some((message) => message.authorType === 'SYSTEM'), false);
  assert.equal((await asAdmin('POST', `/admin/v1/chats/${first.id}/messages`, { body: 'Hi from the first agent' })).body.data.agentName, 'Meera', 'a reply does not steal the chat');

  // closing ends it: the customer sees no open chat, and the next message starts a new one
  assert.equal((await asAdmin('POST', `/admin/v1/chats/${first.id}/close`)).body.data.status, 'CLOSED');
  assert.equal((await asAdmin('POST', `/admin/v1/chats/${first.id}/messages`, { body: 'late' })).body.error.code, 'CHAT_CLOSED');
  assert.equal((await asCustomer('GET', '/customer/v1/support/chat')).body.data, null);
  const second = (await asCustomer('POST', '/customer/v1/support/chat/messages', { body: 'One more thing' })).body.data;
  assert.notEqual(second.id, first.id);
  assert.equal((await asAdmin('GET', '/admin/v1/chats?status=CLOSED')).body.data.length, 1);

  // history: both chats, newest first; an ended chat opens as a transcript; other customers' chats are not found
  const history = (await asCustomer('GET', '/customer/v1/support/chats')).body.data;
  assert.deepEqual([history.items.length, history.items[0].id, history.items[1].status], [2, second.id, 'CLOSED']);
  assert.equal((await asCustomer('GET', `/customer/v1/support/chats/${first.id}`)).body.data.messages.length > 3, true);
  assert.equal((await call(signAccessToken({ sub: String(otherAdmin._id), role: 'CUSTOMER' }), 'GET', `/customer/v1/support/chats/${first.id}`)).status, 404);
});
