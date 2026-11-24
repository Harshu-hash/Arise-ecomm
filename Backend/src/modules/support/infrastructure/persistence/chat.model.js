import mongoose from 'mongoose';

// One live-chat conversation per customer at a time: OPEN until an agent closes it, after which the customer's next message starts a new one.
const conversationSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, immutable: true },
    customerName: { type: String, required: true, immutable: true },
    orderId: { type: String, default: null }, // the order the customer opened the chat about, if any
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    agentId: { type: String, default: null }, // the admin handling it (first to reply, or whoever it was transferred to); null = unclaimed
    agentName: { type: String, default: null },
    customerUnread: { type: Number, default: 0 }, // agent messages the customer has not opened yet
    agentUnread: { type: Number, default: 0 }, // customer messages no agent has opened yet
    lastMessageAt: { type: Date, required: true },
    lastMessagePreview: { type: String, default: '' },
    lastSender: { type: String, enum: ['CUSTOMER', 'AGENT'], required: true },
    closedAt: { type: Date, default: null },
  },
  { collection: 'chat_conversations', timestamps: true, versionKey: false },
);
conversationSchema.index({ customerId: 1, status: 1 });
conversationSchema.index({ status: 1, lastMessageAt: -1 });

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    senderType: { type: String, enum: ['CUSTOMER', 'AGENT', 'SYSTEM'], required: true, immutable: true }, // SYSTEM = internal notes such as transfers; never shown to customers
    senderId: { type: String, required: true, immutable: true },
    body: { type: String, trim: true, default: '', maxlength: 2000, immutable: true },
    attachments: { type: [String], default: [], immutable: true }, // private storage keys of photos
  },
  { collection: 'chat_messages', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
messageSchema.index({ conversationId: 1, _id: 1 });

export const ChatConversation = mongoose.models.ChatConversation ?? mongoose.model('ChatConversation', conversationSchema);
export const ChatMessage = mongoose.models.ChatMessage ?? mongoose.model('ChatMessage', messageSchema);
