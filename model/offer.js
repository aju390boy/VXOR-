const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true},
    discountPercentage: { type: Number, required: true, min: 1, max: 90 },
    startDate: {type: Date, required: true },
    endDate: { type: Date,required: true},
    applicable_on_category: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category'}],
    applicable_on_product: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    applicable_on_brand: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Brand'}],
    isActive: { type: Boolean,default: true}
}, { timestamps: true });

module.exports = mongoose.model('Offer', offerSchema);