import mongoose from 'mongoose';

// "Found this helpful": one vote per person per review or answer. The target's helpfulCount follows the votes.
const voteSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ['REVIEW', 'ANSWER'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: String, required: true },
  },
  { collection: 'helpful_votes', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
voteSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });
voteSchema.index({ userId: 1, targetType: 1, targetId: 1 });

export const HelpfulVote = mongoose.models.HelpfulVote ?? mongoose.model('HelpfulVote', voteSchema);
