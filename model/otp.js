const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  emailOrPhone: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // expires in 10 minutes
  },
});

module.exports = mongoose.model('Otp', otpSchema);
