const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: { 
        type: String,
        required: true,
        trim: true
    },
    otp: { 
        type: String,
        required: true
    },
    context: { 
        type: String,
        enum: ['signup', 'forgot-password'], 
        required: true
    },
    expiresAt: { 
        type: Date,
        required: true,
        index: { expires: '0s' }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Otp = mongoose.model('Otp', otpSchema);
module.exports = Otp;
