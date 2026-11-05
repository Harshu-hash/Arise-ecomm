import mongoose from 'mongoose';

const processedEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, immutable: true },
    eventType: { type: String, required: true, immutable: true },
    handlerName: { type: String, required: true, immutable: true },
    processedAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { collection: 'processedEvents', timestamps: false, versionKey: false },
);

processedEventSchema.index({ eventId: 1, handlerName: 1 }, { unique: true });
processedEventSchema.index({ processedAt: 1 });

export const ProcessedEvent =
  mongoose.models.ProcessedEvent ?? mongoose.model('ProcessedEvent', processedEventSchema);

