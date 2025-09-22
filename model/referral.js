const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  referrer_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referred_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referral_order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  reward_amount: { type: Number, default: 0 },
  reward_given: { type: Boolean, default: false },
  status: { type: String, enum: ['PENDING', 'REWARDED', 'CANCELLED'], default: 'PENDING' },
  createdAt: { type: Date, default: Date.now },
  usedAt: { type: Date }
});

const Referral = mongoose.model('Referral',referralSchema);
module.exports = Referral;

