const mongoose = require('mongoose');

const referredUserSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referral_order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  reward_amount: { type: Number, default: 0 },
  reward_given: { type: Boolean, default: false },
  status: { type: String, enum: ['PENDING', 'REWARDED', 'CANCELLED'], default: 'PENDING' },
  usedAt: { type: Date }
});
const referralSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  referrer_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referred_users: [referredUserSchema], 
  createdAt: { type: Date, default: Date.now }
});

const Referral = mongoose.model('Referral', referralSchema);
module.exports = Referral;
