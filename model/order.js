const mongoose = require('mongoose');

const productInOrderSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number },
    price: { type: Number },
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
            'CANCELLATION REQUESTED'
        ],
        default: 'PROCESSING',
    },
     colorName: { type: String },
    size: { type: String },
    cancellation_reason: {
        type: String,
        default: null
    },
    return_reason: {
        type: String,
        default: null
    }
});
const orderSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
     order_id: { type: String, unique: true },
    products: [productInOrderSchema], 
    address_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
    payment_status: { type: String, enum: ['COMPLETED','PENDING','REFUNDED','FAILED','PROCESSING'], default: 'PENDING' },
    coupon_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    total_amount: { type: Number },
}, { timestamps: true });

orderSchema.pre('save', async function(next) {
    if (this.isNew) {
        const prefix = 'VXOR'; 
        const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.order_id = `${prefix}-${randomString}-${Date.now()}`;
    }
    next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;