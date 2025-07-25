const mongoose=require('mongoose');

const orderSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  products: [{
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number },
    price: { type: Number }
  }],
  address_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
  status: { type: String, enum: ['pending', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  coupon_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
  total_amount: { type: Number },
  payment_status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
