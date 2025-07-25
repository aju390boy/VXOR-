const mongoose = require('mongoose');

// 1. Define the Schema for individual Size/Price/Stock variants
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
}, { _id: false }); // Set _id: false if these sub-documents don't need their own MongoDB _id

// 2. Define the Schema for Color Variants (which includes images and size variants)
const ColorVariantSchema = new mongoose.Schema({
    colorName: {
        type: String,
        required: true
    },
    images: [{ // Array to store image filenames specific to this color
        type: String,
        required: true
    }],
    variants: [SizeVariantSchema] // Array of size/price/stock variants for this color
}, { _id: false }); // Set _id: false if these sub-documents don't need their own MongoDB _id

// 3. Define the main Product Schema
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
        min: 0 // Ensure warranty is not negative
    },
    // This is the crucial field to store your structured color variants data
    colorVariants: [ColorVariantSchema],
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    isListed: { // Corresponds to your isListed checkbox
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    bestSellers: {
        type: Boolean,
        default: false // Default to false, so products are not bestsellers unless explicitly set
    },
    // You might want to calculate min_price dynamically or when saving
    min_price: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Optional: Add a pre-save hook to calculate min_price if desired
// productSchema.pre('save', function(next) {
//     if (this.colorVariants && this.colorVariants.length > 0) {
//         let minPrice = Infinity;
//         this.colorVariants.forEach(colorVar => {
//             if (colorVar.variants && colorVar.variants.length > 0) {
//                 colorVar.variants.forEach(sizeVar => {
//                     if (sizeVar.price < minPrice) {
//                         minPrice = sizeVar.price;
//                     }
//                 });
//             }
//         });
//         this.min_price = (minPrice === Infinity) ? 0 : minPrice;
//     } else {
//         this.min_price = 0;
//     }
//     next();
// });


module.exports = mongoose.model('Product', productSchema);