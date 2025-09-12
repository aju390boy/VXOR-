const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
    product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product', // This must match the name you used for your Product model
        required: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false }); // No separate _id for subdocuments

const wishlistSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // This must match your User model name
        required: true,
        unique: true // Each user has only one wishlist
    },
    products: [wishlistItemSchema]
}, {
    timestamps: true // Adds createdAt and updatedAt
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;