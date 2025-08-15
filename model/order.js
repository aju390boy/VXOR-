const mongoose=require('mongoose');

const orderSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  products: [{
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number },
    price: { type: Number }
  }],
  address_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
  payment_status: { type: String, enum: ['COMPLETED','PENDING','REFUNDED','FAILED','PROCESSING'], default: 'PENDING' },
  coupon_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
  total_amount: { type: Number },
status: {
          type: String,
          enum: [
            'PROCESSING',
            'PACKED',
            'SHIPPED',
            'DELIVERED',
            'RETURN REQUESTED',
            'CANCELLED',
            'RETURNED',
          ],
          default: 'PROCESSING',
        },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
