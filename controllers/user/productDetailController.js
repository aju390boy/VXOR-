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

        if (!product || product.isDeleted) { // Added isDeleted check here
            return res.status(404).send("Product not found or is deleted.");
        }

        // --- Data Transformation for EJS Template ---
        // We will send the full product.colorVariants to the EJS for client-side logic
        // But also prepare some default values for initial render

        let initialDisplayPrice = 0;
        let initialRegularPrice = 0;
        let initialImages = [];
        let initialAvailableSizes = [];

        // Determine initial display data (usually from the first color variant)
        if (product.colorVariants && product.colorVariants.length > 0) {
            const defaultColorVariant = product.colorVariants[0];

            // Set initial images
            if (defaultColorVariant.images && Array.isArray(defaultColorVariant.images)) {
                initialImages = defaultColorVariant.images.map(img => `/uploads/products/${img}`);
            } else {
                initialImages.push('/images/placeholder.png'); // Fallback if first variant has no images
            }

            // Calculate initial min price for the default color variant
            let minPriceForDefaultVariant = Infinity;
            let maxPriceForDefaultVariant = 0; // To get a 'regular_price' for discount calculation
            if (defaultColorVariant.variants && Array.isArray(defaultColorVariant.variants)) {
                defaultColorVariant.variants.forEach(sizeVariant => {
                    if (sizeVariant.price !== undefined && typeof sizeVariant.price === 'number') {
                        if (sizeVariant.price < minPriceForDefaultVariant) {
                            minPriceForDefaultVariant = sizeVariant.price;
                        }
                        if (sizeVariant.price > maxPriceForDefaultVariant) {
                            maxPriceForDefaultVariant = sizeVariant.price;
                        }
                        // Collect available sizes for the default color variant
                        if (sizeVariant.size && !initialAvailableSizes.includes(sizeVariant.size)) {
                            initialAvailableSizes.push(sizeVariant.size);
                        }
                    }
                });
            }
            initialDisplayPrice = (minPriceForDefaultVariant === Infinity) ? 0 : minPriceForDefaultVariant;
            initialRegularPrice = maxPriceForDefaultVariant; // This will be the highest price of the default variant
        } else {
            // No color variants, so no dynamic images/prices/sizes. Use a generic placeholder.
            initialImages.push('/images/placeholder.png');
        }

        // Ensure prices are numbers for toFixed and calculations in EJS
        product.display_price = parseFloat(initialDisplayPrice);
        product.regular_price = parseFloat(initialRegularPrice);
        if (isNaN(product.display_price)) product.display_price = 0;
        if (isNaN(product.regular_price)) product.regular_price = 0;

        // Ensure 'rating' is a number
        product.rating = product.rating || 0;

        // Pass structured data to EJS
        res.render("user/productDetail", {
            product: {
                _id: product._id,
                title: product.title,
                description: product.description, // Pass description for detail tab
                rating: product.rating,
                // These are for initial render. JS will update them.
                display_price: product.display_price,
                regular_price: product.regular_price,
                images: initialImages, // Initial images for display
                // Pass the full colorVariants for client-side processing
                colorVariants: product.colorVariants,
                // These are populated for the initial view, but JS will control them
                sizes: initialAvailableSizes,
                colors: product.colorVariants ? product.colorVariants.map(cv => cv.colorName) : [],
                warranty: product.warranty, // Include other top-level fields you might want to display
                // ... any other top-level fields like category_id, brand_id if needed directly
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