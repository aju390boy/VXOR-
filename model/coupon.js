const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, required: [true, 'Coupon code is required.'], unique: true, trim: true, uppercase: true},
    description: { type: String,required: [true, 'A description for the coupon is required.'],trim: true },
    discountType: { type: String, required: true, enum: ['percentage', 'fixed_amount']},// Restricts the value to one of these two
    discountValue: {  type: Number, required: true,  min: 0},
    minPurchaseAmount: { type: Number,required: true,default: 0},
    maxDiscountAmount: {  type: Number,  min: 0},
    expiryDate: { type: Date, required: true },
    usageLimit: { type: Number, required: true, min: 1 },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User'
    }],
    isActive: { type: Boolean, default: true}
}, {
    timestamps: true
});

// A virtual property to check if the coupon is expired.
couponSchema.virtual('isExpired').get(function() {
    return this.expiryDate < new Date();
});
// A virtual property to check the remaining uses of the coupon.
couponSchema.virtual('remainingUses').get(function() {
    return this.usageLimit - this.usedBy.length;
});

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;