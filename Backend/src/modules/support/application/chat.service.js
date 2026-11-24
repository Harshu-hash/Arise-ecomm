import { env } from '../../../config/env.js';
import { emitTo, rooms } from '../../../infrastructure/realtime/socket.js';
import { AppError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { deviceUrl } from '../../../shared/utils/mediaUrl.js';
import { signFileToken } from '../../../shared/utils/signedUrl.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { getCustomerContact, User } from '../../identity/public/index.js';
import { notify } from '../../notification/public/index.js';
import { ChatConversation, ChatMessage } from '../infrastructure/persistence/chat.model.js';

// Live chat between a customer and the support team. Messages are saved over HTTP first; the socket only carries small
// "chat:changed" / "chat:typing" hints, and clients refetch (same pattern as orders).

const AGENT_NAME = 'Arise Support';
const MAX_ATTACHMENTS = 3;
const ATTACHMENT_URL_TTL_SECONDS = 3600; // a chat screen can stay open a while; the usual 5 minutes would break its photos
const PHOTO_PREVIEW = 'Photo';
const iso = (date) => date.toISOString();

// Photos are private files in the sender's own folder: private/chat/<senderId>/<uuid>.<ext>
const ownAttachment = (senderId, key) => new RegExp(`^private/chat/${String(senderId).replace(/[^\w-]/g, '')}/[0-9a-f-]{36}\\.[a-z0-9]{3,4}$`).test(String(key));

function attachmentUrl(key) {
  const [, folder, ownerId, file] = key.split('/');
  return deviceUrl(`${env.PUBLIC_ORIGIN}/api/seller/v1/uploads/private/${folder}/${ownerId}/${file}?token=${signFileToken(key, ATTACHMENT_URL_TTL_SECONDS)}`);
}

const toMessageDto = (message) => ({
  id: String(message._id),
  authorType: message.senderType,
  authorDisplayName: { AGENT: AGENT_NAME, SYSTEM: 'System' }[message.senderType] ?? 'You',
  body: message.body,
  attachments: (message.attachments ?? []).map((key) => ({ id: key, url: attachmentUrl(key) })),
  createdAt: iso(message.createdAt),
});

const toConversationDto = (conversation, { messages, forAdmin = false } = {}) => ({
  id: String(conversation._id),
  status: conversation.status,
  orderId: conversation.orderId,
  createdAt: iso(conversation.createdAt),
  lastMessageAt: iso(conversation.lastMessageAt),
  lastMessagePreview: conversation.lastMessagePreview,
  unreadCount: forAdmin ? conversation.agentUnread : conversation.customerUnread,
  ...(forAdmin && {
    customerId: conversation.customerId,
    customerName: conversation.customerName,
    agentId: conversation.agentId,
    agentName: conversation.agentName,
    waitingForAgent: conversation.status === 'OPEN' && conversation.lastSender === 'CUSTOMER',
  }),
  // internal notes (transfers) are for agents only
  ...(messages && { messages: messages.filter((message) => forAdmin || message.senderType !== 'SYSTEM').map(toMessageDto) }),
});

const hint = (conversation) => {
  const payload = { conversationId: String(conversation._id), at: new Date().toISOString() };
  emitTo(rooms.user(conversation.customerId), 'chat:changed', payload);
  emitTo(rooms.admin, 'chat:changed', payload);
};

const messagesOf = (conversation) => ChatMessage.find({ conversationId: conversation._id }).sort({ _id: 1 }).lean();

/** Checks and de-duplicates what a sender wants to post: some text or at least one of their own photos. */
function cleanContent(senderId, { body = '', attachments = [] }) {
  const photos = [...new Set(attachments)];
  if (!body.trim() && !photos.length) throw new ValidationError('Write a message or add a photo.', { body: ['Write a message or add a photo.'] });
  if (photos.length > MAX_ATTACHMENTS || !photos.every((key) => ownAttachment(senderId, key))) throw new AppError({ code: 'ATTACHMENT_INVALID', status: 422, message: 'One or more photos are invalid. Upload them again.' });
  return { body: body.trim(), attachments: photos };
}

/** Saves one message and moves the conversation's summary line. The update only matches an OPEN chat, so a chat closed meanwhile rejects the send. */
async function append(conversation, senderType, senderId, content, { claim = null } = {}) {
  const { body, attachments } = cleanContent(senderId, content);
  const unread = senderType === 'CUSTOMER' ? 'agentUnread' : 'customerUnread';
  const filter = { _id: conversation._id, status: 'OPEN' };
  const updated = await ChatConversation.findOneAndUpdate(
    filter,
    {
      $set: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 120) || PHOTO_PREVIEW, lastSender: senderType },
      $inc: { [unread]: 1 },
    },
    { new: true },
  );
  if (!updated) throw new AppError({ code: 'CHAT_CLOSED', status: 409, message: 'This chat has ended.' });
  await ChatMessage.create({ conversationId: conversation._id, senderType, senderId, body, attachments });
  // the first agent to reply takes an unclaimed chat; later repliers do not steal it from whoever has it
  if (claim && !updated.agentId) {
    const claimed = await ChatConversation.findOneAndUpdate({ _id: conversation._id, agentId: null }, { $set: claim }, { new: true });
    if (claimed) Object.assign(updated, claim);
  }
  hint(updated);
  return updated;
}

// ---------- customer ----------

/** The customer's current open chat with its messages, or null when they have none. */
export async function getMyChat(customerId) {
  const conversation = await ChatConversation.findOne({ customerId: String(customerId), status: 'OPEN' }).lean();
  return conversation && toConversationDto(conversation, { messages: await messagesOf(conversation) });
}

/** Any of the customer's own chats, open or ended, as a read-only transcript. */
export async function getMyChatById(customerId, id) {
  const conversation = await ChatConversation.findOne({ _id: id, customerId: String(customerId) }).lean();
  if (!conversation) throw new NotFoundError('That chat was not found.');
  return toConversationDto(conversation, { messages: await messagesOf(conversation) });
}

/** Past and current chats, newest first. */
export async function listMyChats(customerId, { cursor, limit }) {
  const filter = { customerId: String(customerId), ...(cursor && { _id: { $lt: cursor } }) };
  const rows = await ChatConversation.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const items = rows.slice(0, limit);
  return { items: items.map((row) => toConversationDto(row)), nextCursor: rows.length > limit ? String(items.at(-1)._id) : null };
}

/** The customer opened the chat: their unread count goes to zero. */
export async function markMyChatRead(customerId) {
  await ChatConversation.updateOne({ customerId: String(customerId), status: 'OPEN', customerUnread: { $gt: 0 } }, { $set: { customerUnread: 0 } });
  return getMyChat(customerId);
}

/** Sends a customer message, starting a chat if none is open. */
export async function sendCustomerMessage(customerId, { body, attachments, orderId = null }) {
  const id = String(customerId);
  let conversation = await ChatConversation.findOne({ customerId: id, status: 'OPEN' });
  if (!conversation) {
    cleanContent(id, { body, attachments }); // reject a bad first message before creating an empty chat
    const contact = await getCustomerContact(id);
    conversation = await ChatConversation.create({
      customerId: id,
      customerName: contact?.name || 'Customer',
      orderId,
      lastMessageAt: new Date(),
      lastSender: 'CUSTOMER',
    });
  }
  await append(conversation, 'CUSTOMER', id, { body, attachments });
  return getMyChat(id);
}

/** Phone, email and hours from Settings, plus the chat itself. Nothing is hard-coded: an admin edits these in the console. */
export async function getSupportChannels() {
  const [general, support] = await Promise.all([getSettingsSection('general'), getSettingsSection('support')]);
  const channels = [{ id: 'chat', type: 'CHAT', label: 'Live chat', description: 'Message our support team', href: 'arise://support/chat', enabled: true }];
  const phone = general.supportPhone?.replace(/[^\d+]/g, '');
  if (phone) channels.push({ id: 'phone', type: 'PHONE', label: 'Call us', description: general.supportPhone, href: `tel:${phone}`, enabled: true });
  if (general.supportEmail) channels.push({ id: 'email', type: 'EMAIL', label: 'Email us', description: general.supportEmail, href: `mailto:${general.supportEmail}`, enabled: true });
  return { availabilityLabel: `Our team is available ${support.businessHoursStart} to ${support.businessHoursEnd}. Leave a message any time and we will reply.`, channels };
}

// ---------- admin ----------

const agentLabel = async (agentId) => {
  const user = await User.findById(agentId, 'name email').lean();
  return user?.name || user?.email || 'Agent';
};

export async function listChatsForAdmin({ status }) {
  const rows = await ChatConversation.find({ status }).sort({ lastMessageAt: -1 }).limit(200).lean();
  return rows.map((row) => toConversationDto(row, { forAdmin: true }));
}

async function loadConversation(id) {
  const conversation = await ChatConversation.findById(id);
  if (!conversation) throw new NotFoundError('That chat was not found.');
  return conversation;
}

export async function getChatForAdmin(id) {
  const conversation = await loadConversation(id);
  return toConversationDto(conversation, { forAdmin: true, messages: await messagesOf(conversation) });
}

/** An agent opened the chat: its unread count goes to zero. */
export async function markChatReadByAgent(id) {
  await ChatConversation.updateOne({ _id: id, agentUnread: { $gt: 0 } }, { $set: { agentUnread: 0 } });
  return getChatForAdmin(id);
}

export async function replyAsAgent(id, content, agentId) {
  const claim = { agentId: String(agentId), agentName: await agentLabel(agentId) };
  const conversation = await append(await loadConversation(id), 'AGENT', String(agentId), content, { claim });
  notify({
    to: { type: 'CUSTOMER', id: conversation.customerId },
    category: 'SUPPORT',
    title: 'New reply from Arise Support',
    body: conversation.lastMessagePreview,
    key: `chat:${conversation._id}:${conversation.lastMessageAt.getTime()}`,
    target: { type: 'CHAT', entityId: String(conversation._id) },
  });
  return getChatForAdmin(id);
}

/** Admins who can take a chat: anyone holding support.chat.handle (or every permission). */
export async function listChatAgents() {
  const users = await User.find({ role: 'ADMIN', status: 'ACTIVE', permissions: { $in: ['*', 'support.chat.handle'] } }, 'name email').lean();
  return users.map((user) => ({ id: String(user._id), name: user.name || user.email }));
}

/** Hands an open chat to another agent, leaving an internal note in the thread. */
export async function transferChat(id, toAgentId, actorId) {
  const target = (await listChatAgents()).find((agent) => agent.id === String(toAgentId));
  if (!target) throw new ValidationError('Choose an agent who handles chats.', { agentId: ['Choose an agent who handles chats.'] });
  const conversation = await ChatConversation.findOneAndUpdate({ _id: id, status: 'OPEN' }, { $set: { agentId: target.id, agentName: target.name } });
  if (!conversation) throw new NotFoundError('That chat was not found or has already ended.');
  await ChatMessage.create({ conversationId: conversation._id, senderType: 'SYSTEM', senderId: String(actorId), body: `${await agentLabel(actorId)} transferred this chat to ${target.name}.` });
  hint(conversation);
  return getChatForAdmin(id);
}

export async function closeChat(id) {
  const conversation = await ChatConversation.findOneAndUpdate({ _id: id, status: 'OPEN' }, { $set: { status: 'CLOSED', closedAt: new Date() } }, { new: true });
  if (!conversation) throw new NotFoundError('That chat was not found or has already ended.');
  hint(conversation);
  return getChatForAdmin(id);
}
