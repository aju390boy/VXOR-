const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discount_value: { type: Number, required: true },
  coupon_type: { type: String, enum: ['percentage', 'flat'], required: true },
  limit: { type: Number },
  expiry_date: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  max_discount: { type: Number },
  min_discount: { type: Number },
  description: { type: String }
}, { timestamps: true }); 

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
