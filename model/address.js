const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  street_address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pin_code: { type: Number, required: true },
  country: { type: String, default: 'India' }
}, { timestamps: true });

const Address = mongoose.model('Address', addressSchema);
module.exports = Address;
