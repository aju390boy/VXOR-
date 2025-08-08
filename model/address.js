const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  mobile: { type: String,required: true },
  address1: {type: String, required: true },
  address2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' }
}, { timestamps: true });

const Address = mongoose.model('Address', addressSchema);
module.exports = Address;