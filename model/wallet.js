const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'], 
        required: true
    },
    description: {
        type: String,
        required: true 
    },
    orderId: { 
        type: String 
    }
}, {
    timestamps: true 
});
const walletSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true,
        unique: true 
    },
    balance: {
        type: Number,
        required: true,
        default: 0,
        min: 0 
    },
    transactions: [transactionSchema]
});

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;