const mongoose = require('mongoose');

const SizeVariantSchema = new mongoose.Schema({
    size: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        required: true
    }
}, { _id: false }); 
const ColorVariantSchema = new mongoose.Schema({
    colorName: {
        type: String,
        required: true
    },
    images: [{ 
        type: String,
        required: true
    }],
    variants: [SizeVariantSchema]
}); 
const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    brand_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand',
        required: true
    },
    warranty: {
        type: Number,
        min: 0 
    },
    colorVariants: [ColorVariantSchema],
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    isListed: { 
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    bestSellers: {
        type: Boolean,
        default: false
    },
    min_price: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});


module.exports = mongoose.model('Product', productSchema);