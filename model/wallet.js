const mongoose = require('mongoose');

/**
 * Defines the structure for a single transaction within the wallet.
 * This will be a sub-document in the main Wallet schema.
 */
const transactionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'], // 'credit' for refunds, 'debit' for payments
        required: true
    },
    description: {
        type: String,
        required: true // e.g., "Refund for Order #XYZ", "Paid for Order #ABC"
    },
    orderId: { // Optional: to link a transaction to a specific order
        type: String 
    }
}, {
    timestamps: true // Automatically adds createdAt for the transaction date
});


/**
 * Defines the main wallet for a user.
 * Each user will have exactly one wallet document.
 */
const walletSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Links to your User model
        required: true,
        unique: true // Ensures one wallet per user
    },
    balance: {
        type: Number,
        required: true,
        default: 0,
        min: 0 // Prevents the balance from going below zero
    },
    transactions: [transactionSchema] // An array to store the history of all transactions
});

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;