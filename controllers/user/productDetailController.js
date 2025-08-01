const Product = require('../../model/product.js');
const Category = require('../../model/category.js');
const Brand = require('../../model/brand.js');
const mongoose = require('mongoose');

///Product Detailing\\\
exports.getSingleProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        let product = await Product.findById(productId)
            .populate('category_id')
            .populate('brand_id')
            .lean();

        if (!product || product.isDeleted) { 
            return res.status(404).send("Product not found or is deleted.");
        }

        
        let initialDisplayPrice = 0;
        let initialRegularPrice = 0;
        let initialImages = [];
        let initialAvailableSizes = [];

      
        if (product.colorVariants && product.colorVariants.length > 0) {
            const defaultColorVariant = product.colorVariants[0];

            
            if (defaultColorVariant.images && Array.isArray(defaultColorVariant.images)) {
                initialImages = defaultColorVariant.images.map(img => `/uploads/products/${img}`);
            } else {
                initialImages.push('/images/placeholder.png'); 
            }

           
            let minPriceForDefaultVariant = Infinity;
            let maxPriceForDefaultVariant = 0;
            if (defaultColorVariant.variants && Array.isArray(defaultColorVariant.variants)) {
                defaultColorVariant.variants.forEach(sizeVariant => {
                    if (sizeVariant.price !== undefined && typeof sizeVariant.price === 'number') {
                        if (sizeVariant.price < minPriceForDefaultVariant) {
                            minPriceForDefaultVariant = sizeVariant.price;
                        }
                        if (sizeVariant.price > maxPriceForDefaultVariant) {
                            maxPriceForDefaultVariant = sizeVariant.price;
                        }
                       
                        if (sizeVariant.size && !initialAvailableSizes.includes(sizeVariant.size)) {
                            initialAvailableSizes.push(sizeVariant.size);
                        }
                    }
                });
            }
            initialDisplayPrice = (minPriceForDefaultVariant === Infinity) ? 0 : minPriceForDefaultVariant;
            initialRegularPrice = maxPriceForDefaultVariant;
        } else {
           
            initialImages.push('/images/placeholder.png');
        }

       
        product.display_price = parseFloat(initialDisplayPrice);
        product.regular_price = parseFloat(initialRegularPrice);
        if (isNaN(product.display_price)) product.display_price = 0;
        if (isNaN(product.regular_price)) product.regular_price = 0;

       
        product.rating = product.rating || 0;

        
        res.render("user/productDetail", {
            product: {
                _id: product._id,
                title: product.title,
                description: product.description, 
                rating: product.rating,
                display_price: product.display_price,
                regular_price: product.regular_price,
                images: initialImages, 
                colorVariants: product.colorVariants,
                sizes: initialAvailableSizes,
                colors: product.colorVariants ? product.colorVariants.map(cv => cv.colorName) : [],
                warranty: product.warranty, 
            },
            title: product.title || 'Product Details'
        });

    } catch (err) {
        console.error("Product Detail Error:", err);
        if (!res.headersSent) {
            res.status(500).send("Server Error fetching product details.");
        }
    }
};