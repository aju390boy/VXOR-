const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
    },
    colorName: { // This field is required to store the selected color
        type: String, 
        required: true 
    },
    size: { // This field is required to store the selected size
        type: String, 
        required: true 
    },
    quantity: { 
        type: Number, 
        required: true, 
        min: 1 
    }
}, { _id: false }); // _id: false prevents Mongoose from automatically adding an _id to subdocuments

// Main Cart Schema
const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // A user can only have one cart
    },
    items: [cartItemSchema] // The cart is an array of these detailed cart item objects
}, {
    timestamps: true
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
