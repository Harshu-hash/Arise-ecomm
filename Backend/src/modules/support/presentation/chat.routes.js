import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { createRateLimiter } from '../../../shared/middleware/rateLimit.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { closeChat, getChatForAdmin, getMyChat, getMyChatById, getSupportChannels, listChatAgents, listChatsForAdmin, listMyChats, markChatReadByAgent, markMyChatRead, replyAsAgent, sendCustomerMessage, transferChat } from '../application/chat.service.js';

const content = { body: z.string().trim().max(2000).default(''), attachments: z.array(z.string().max(300)).max(3).default([]) };
const messageBody = z.object(content);
const customerMessage = z.object({ ...content, orderId: objectIdSchema.optional() });
const historyQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: objectIdSchema.optional() });
const idParams = z.object({ id: objectIdSchema });
const listQuery = z.object({ status: z.enum(['OPEN', 'CLOSED']).default('OPEN') });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/customer/v1.
export function createCustomerChatRouter() {
  const router = Router();
  const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];
  const sendLimit = createRateLimiter({ name: 'chat-send', windowMs: 60_000, limit: 20 });

  router.get('/support/channels', route(async (_req, res) => sendData(res, await getSupportChannels())));
  router.get('/support/chat', ...customerOnly, route(async (req, res) => sendData(res, await getMyChat(req.auth.userId))));
  router.post('/support/chat/read', ...customerOnly, route(async (req, res) => sendCommand(res, await markMyChatRead(req.auth.userId))));
  router.get('/support/chats', ...customerOnly, validate({ query: historyQuery }), route(async (req, res) => sendData(res, await listMyChats(req.auth.userId, req.query))));
  router.get('/support/chats/:id', ...customerOnly, validate({ params: idParams }), route(async (req, res) => sendData(res, await getMyChatById(req.auth.userId, req.params.id))));
  router.post('/support/chat/messages', ...customerOnly, sendLimit, validate({ body: customerMessage }), route(async (req, res) =>
    sendCommand(res, await sendCustomerMessage(req.auth.userId, req.body), { status: 201 })));
  return router;
}

// Mounted at /api/admin/v1/chats.
export function createAdminChatRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN), requirePermission('support.chat.handle'));

  router.get('/', validate({ query: listQuery }), route(async (req, res) => sendData(res, await listChatsForAdmin(req.query))));
  router.get('/agents', route(async (_req, res) => sendData(res, await listChatAgents())));
  router.get('/:id', validate({ params: idParams }), route(async (req, res) => sendData(res, await getChatForAdmin(req.params.id))));
  router.post('/:id/messages', validate({ params: idParams, body: messageBody }), route(async (req, res) =>
    sendCommand(res, await replyAsAgent(req.params.id, req.body, req.auth.userId), { status: 201 })));
  router.post('/:id/read', validate({ params: idParams }), route(async (req, res) => sendCommand(res, await markChatReadByAgent(req.params.id))));
  router.post('/:id/transfer', validate({ params: idParams, body: z.object({ agentId: objectIdSchema }) }), route(async (req, res) =>
    sendCommand(res, await transferChat(req.params.id, req.body.agentId, req.auth.userId))));
  router.post('/:id/close', validate({ params: idParams }), route(async (req, res) => sendCommand(res, await closeChat(req.params.id))));
  return router;
}
