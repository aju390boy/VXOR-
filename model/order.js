const mongoose = require('mongoose');

const productInOrderSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true},
  quantity: { type: Number, min: 1, required: true },
  price: { type: Number, min: 0, required: true },
  status: {type: String,
    enum: [
      'PENDING',             // order placed, payment not done
      'CONFIRMED',           // payment completed, order accepted
      'PROCESSING',          // being prepared
      'PACKED',              // packed and ready for shipment
      'SHIPPED',             // handed over to courier
      'DELIVERED',           // customer received
      'CANCELLATION REQUESTED', 
      'CANCELLED',
      'RETURN REQUESTED',
      'RETURNED'
    ],default: 'PENDING', index: true},
  status_history: [{ status: {type: String,
      enum: [
      'PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED',
      'CANCELLATION REQUESTED', 'CANCELLED', 'RETURN REQUESTED', 'RETURNED'],
  required: true},
  timestamp: {type: Date,default: Date.now,required: true}}],
  colorName: { type: String },
  size: { type: String },
  offer_applied: { type: Number, min: 0, default: 0 },
  cancellation_reason: {reason: { type: String },requestedAt: { type: Date }},
  return_reason: { reason: { type: String },requestedAt: { type: Date } },
  expected_delivery: { type: Date,  default: () => new Date(Date.now() + 7*24*60*60*1000)},
  prev_status:{type:String}
});

const shippingAddressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  address1: { type: String, required: true },
  address2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  order_id: { type: String},
  products: [productInOrderSchema], 
  address_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Address', required: true },
  payment_status:{type: String,enum:['PENDING','PROCESSING','COMPLETED','FAILED','REFUNDED'],default:'PENDING',index:true},
  order_cancellation_reason: { reason: { type: String }, requestedAt: { type: Date }},
  order_return_reason: { reason: { type: String }, requestedAt: { type: Date }},
  payment_method: { type: String,enum: [
                'COD',              // Cash on Delivery
                'ONLINE',           // any online mode (UPI, card, etc.)
                'WALLET',            // from user’s wallet
                'razorpay' ], required: true},
  payment_details: { transactionId: { type: String }, paidAt: { type: Date }},
  coupon_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
  coupon_discount: { type: Number, min: 0, default: 0 },
  concern:{type:String,enum:['RETURN','CANCELLATION','NONE'],default:'NONE'}, 
  total_offer_applied: { type: Number, min: 0, default: 0 },
  tax: { type: Number, min: 0, default: 0 },
  total_amount: { type: Number, min: 0, required: true },
  shipping_address: { type: shippingAddressSchema, required: true }
}, { timestamps: true });


//  get overall status
orderSchema.virtual('overallStatus').get(function() {
  if (!this.products || this.products.length === 0) return 'UNKNOWN';

  const statuses = this.products.map(p => p.status);
  const hierarchy = [
    'RETURNED', 'RETURN REQUESTED', 'CANCELLED', 'CANCELLATION REQUESTED',
    'DELIVERED', 'SHIPPED', 'PACKED', 'PROCESSING', 'CONFIRMED', 'PENDING'
  ];
  
  if (statuses.every(s => s === 'CANCELLED')) return 'CANCELLED';
  if (statuses.every(s => s === 'RETURNED')) return 'RETURNED';

  for (const status of hierarchy) {
    if (statuses.includes(status)) return status;
  }
  return 'PENDING';
});

// Method for update payment status after cancellation/return
orderSchema.methods.updatePaymentStatus = function() {
  const allHandled = this.products.every(
    p => p.status === 'CANCELLED' || p.status === 'RETURNED'
  );
  if (allHandled && this.payment_status === 'COMPLETED') {
    this.payment_status = 'REFUNDED';
  }
};

// Ensure virtuals are included in JSON/Object
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

//generate custom order_id
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const prefix = 'VXOR'; 
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.order_id = `${prefix}-${randomString}-${Date.now()}`;
  }
  next();
});

// Indexes
orderSchema.index({ order_id: 1 });
orderSchema.index({ "products.product_id": 1 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;