const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' }, // Short details about the category
  offer: {
    type: Number,
    min: 0,
    max: 100,
    default: 0, // Percentage offer on the whole category
  },
  isListed: { type: Boolean, default: true }
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
