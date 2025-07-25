const Product = require('../../model/product.js');
const Brand = require('../../model/brand.js');
const Category = require('../../model/category.js');
const multer = require('multer');
const path = require('path');
const mongoose=require('mongoose');



// 🧠 Multer config right here in controller
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure this directory exists in your project root!
        // For example: your_project_root/public/images/products
        cb(null, 'public/uploads/products');
    },
    filename: function (req, file, cb) {
        // Generate a unique filename: product_timestamp_randomString.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product_' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Multer file filter to allow only image types
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/; // Regular expression for allowed image types
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
        return cb(null, true);
    }
    // If the file type is not allowed, pass an error
    const error = new Error("Only .jpeg, .jpg, .png, .gif, .webp format allowed!");
    error.code = 'FILE_TYPE_ERROR'; // Custom error code for easier handling
    cb(error);
};

exports.upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit per file
});


// 📄 GET /admin/addproducts
exports.getAddProductPage = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({}); // Fetch brands for the dropdown

        res.render('admin/addproducts', { categories, brands, layout: false }); // Pass brands to the template

    } catch (err) {
        console.error("Error loading Add Product page:", err.message);
        res.status(500).send('Internal Server Error');
    }
};

// 📤 POST /admin/addproducts
exports.addProduct = async (req, res) => {
    try {
        // Destructure top-level fields
        const {
            title,
            description,
            brand_id,      // Renamed from 'brand' to match schema
            warranty,
            category_id,   // Renamed from 'category' to match schema
            isListed       // From the new checkbox
        } = req.body;

        console.log("🟡 Product POST hit! req.body:", req.body);
        console.log("🟡 Uploaded files:", req.files); // req.files will be an array of all files

        // Process color variants and their nested images/sizes
        const colorVariants = [];

        // req.body.colorVariants will be an object where keys are indices like '0', '1', '2'
        // and values are objects containing colorName, and potentially variants.
        // If there's only one color variant, req.body.colorVariants might not be an array,
        // so we need to handle that.
        const rawColorVariants = req.body.colorVariants;

        // Ensure rawColorVariants is treated as an array of objects
        const parsedColorVariants = Object.values(rawColorVariants || {});


        for (let i = 0; i < parsedColorVariants.length; i++) {
            const variantData = parsedColorVariants[i];
            const variantColorName = variantData.colorName;

            // Extract images for this specific color variant
            const variantImages = req.files
                .filter(file => file.fieldname === `colorVariants[${i}][images]`)
                .map(file => file.filename);

            // Process nested size variants for this color
            const sizesAndStock = [];
            // req.body.colorVariants[i].variants will also be an object if multiple sizes exist
            const rawSizeVariants = variantData.variants;

            // Ensure rawSizeVariants is treated as an array of objects
            const parsedSizeVariants = Object.values(rawSizeVariants || {});

            for (let j = 0; j < parsedSizeVariants.length; j++) {
                const sizeData = parsedSizeVariants[j];
                sizesAndStock.push({
                    size: sizeData.size,
                    price: parseFloat(sizeData.price),
                    stock: parseInt(sizeData.stock, 10)
                });
            }

            colorVariants.push({
                colorName: variantColorName,
                images: variantImages,
                variants: sizesAndStock
            });
        }

        const product = new Product({
            title,
            description,
            brand_id,
            warranty: warranty ? parseInt(warranty, 10) : undefined, // Optional, parse as int
            category_id,
            isListed: isListed === 'true', // Convert string 'true'/'false' to boolean
            colorVariants // Assign the processed color variants array
        });

        await product.save();
        res.redirect('/admin/products');
    } catch (err) {
        console.error("Error saving product:", err.message);
        // More specific error handling
        if (err.code === 'FILE_TYPE_ERROR') {
            return res.status(400).send(err.message);
        }
        res.status(500).send('Error adding product: ' + err.message);
    }
};

