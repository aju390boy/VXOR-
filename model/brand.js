const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },

  description: {
    type: String,
    default: '',
  },

  offer: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },

  image: {
    type: String,
    required: true,
  },

  isListed: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

const Brand = mongoose.model('Brand', brandSchema);
module.exports = Brand;
