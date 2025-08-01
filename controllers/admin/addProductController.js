const Product = require('../../model/product.js');
const Brand = require('../../model/brand.js');
const Category = require('../../model/category.js');
const multer = require('multer');
const path = require('path');
const mongoose=require('mongoose');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/products');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product_' + uniqueSuffix + path.extname(file.originalname));
    }
});
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/; 
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
        return cb(null, true);
    }
    const error = new Error("Only .jpeg, .jpg, .png, .gif, .webp format allowed!");
    error.code = 'FILE_TYPE_ERROR';
    cb(error);
};

exports.upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } 
});

///get addproduct page\\\\
exports.getAddProductPage = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({});

        res.render('admin/addproducts', { categories, brands, layout: false }); 

    } catch (err) {
        console.error("Error loading Add Product page:", err.message);
        res.status(500).send('Internal Server Error');
    }
};

// POST /admin/addproducts
exports.addProduct = async (req, res) => {
    try {
        const {
            title,
            description,
            brand_id,
            warranty,
            category_id,
            isListed
        } = req.body;
        const rawColorVariants = req.body.colorVariants;
        const parsedColorVariants = Object.values(rawColorVariants || {});
        const errors = [];
        const containsLetter = /[a-zA-Z]/.test(title);
        if (!title || title.trim().length < 3 || !containsLetter) {
        if (!title || title.trim().length === 0) {
        errors.push('Product title is required.');
        } else if (!containsLetter) {
        errors.push('Product title must contain at least one alphabetical character.');
        } else {
        errors.push('Product title must be at least 3 characters long.');
        }
        }
        if (!mongoose.Types.ObjectId.isValid(category_id)) {
            errors.push('Invalid category selected.');
        }
        if (!mongoose.Types.ObjectId.isValid(brand_id)) {
            errors.push('Invalid brand selected.');
        }
        if (warranty && (isNaN(parseInt(warranty)) || parseInt(warranty) < 0)) {
            errors.push('Warranty must be a positive number.');
        }
        if (!parsedColorVariants || parsedColorVariants.length === 0) {
            errors.push('At least one color variant is required.');
        }
        if (req.files.length === 0) {
            errors.push('At least one image must be uploaded for the product.');
        }
        parsedColorVariants.forEach((variant, i) => {
            if (!variant.colorName || variant.colorName.trim() === '') {
                errors.push(`Color name is required for variant #${i + 1}.`);
            }
            if (!variant.variants || Object.keys(variant.variants).length === 0) {
                errors.push(`At least one size variant is required for color #${i + 1}.`);
            } else {
                Object.values(variant.variants).forEach((sizeVariant, j) => {
                    if (!sizeVariant.size || sizeVariant.size.trim() === '') {
                        errors.push(`Size is required for size variant #${j + 1} of color #${i + 1}.`);
                    }
                    if (isNaN(parseFloat(sizeVariant.price)) || parseFloat(sizeVariant.price) < 0) {
                        errors.push(`Price must be a positive number for size variant #${j + 1} of color #${i + 1}.`);
                    }
                    if (isNaN(parseInt(sizeVariant.stock)) || parseInt(sizeVariant.stock) < 0) {
                        errors.push(`Stock must be a positive number for size variant #${j + 1} of color #${i + 1}.`);
                    }
                });
            }
        });

        if (errors.length > 0) {
            return res.status(400).json({ message: 'Validation failed', errors: errors });
        }
        const colorVariants = [];
        for (let i = 0; i < parsedColorVariants.length; i++) {
            const variantData = parsedColorVariants[i];
            const variantColorName = variantData.colorName;
            const variantImages = req.files
    .filter(file => file.fieldname === `colorVariants[${i}][images]`)
    .map(file => file.filename); 
            const sizesAndStock = [];
            const rawSizeVariants = variantData.variants;
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
            warranty: warranty ? parseInt(warranty, 10) : undefined,
            category_id,
            isListed: isListed === 'true',
            colorVariants
        });
        await product.save();
        res.status(201).json({ message: 'Product added successfully!' });
    } catch (err) {
        console.error("🔴 An error occurred while saving the product:", err);
        res.status(500).json({ message: 'An unexpected error occurred during submission.', error: err.message });
    }
};

//edit product \\\\
exports.getEditProductPage = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category_id').populate('brand_id');
        const categories = await Category.find();
        const brands = await Brand.find();

        if (!product) {
            return res.status(404).render('admin/404', { message: "Product not found" });
        }

        res.render('admin/addProducts', { product, categories, brands ,layout:false});
    } catch (err) {
        console.error("Error fetching product for edit:", err);
        next(err);
    }
};

//  edit product\\
exports.updateProduct = async (req, res, next) => {
    console.log('arrived')
    try {
        const productId = req.params.id;
        const { title, description, warranty, category_id, brand_id, colorVariants, deletedImages } = req.body;
        const errors = [];

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            errors.push('Invalid product ID.');
        }
        const containsLetter = /[a-zA-Z]/.test(title);
        if (!title || title.trim().length < 3 || !containsLetter) {
            if (!title || title.trim().length === 0) {
                errors.push('Product title is required.');
            } else if (!containsLetter) {
                errors.push('Product title must contain at least one alphabetical character.');
            } else {
                errors.push('Product title must be at least 3 characters long.');
            }
        }
        if (!mongoose.Types.ObjectId.isValid(category_id)) {
            errors.push('Invalid category selected.');
        }
        if (!mongoose.Types.ObjectId.isValid(brand_id)) {
            errors.push('Invalid brand selected.');
        }
        if (warranty && (isNaN(parseInt(warranty)) || parseInt(warranty) < 0)) {
            errors.push('Warranty must be a positive number.');
        }
        if (!colorVariants || colorVariants.length === 0) {
            errors.push('At least one color variant is required.');
        }
        const existingImagesCount = colorVariants.reduce((count, variant) => {
            const existing = Object.values(variant.images || {}).filter(img => img.filename);
            return count + existing.length;
        }, 0);
        
        if (req.files.length + existingImagesCount === 0) {
            errors.push('At least one image must exist for the product.');
        }
       colorVariants.forEach((variant, i) => {
            if (!variant.colorName || variant.colorName.trim() === '') {
                errors.push(`Color name is required for variant #${i + 1}.`);
            }
            if (!variant.variants || Object.keys(variant.variants).length === 0) {
                errors.push(`At least one size variant is required for color #${i + 1}.`);
            } else {
                Object.values(variant.variants).forEach((sizeVariant, j) => {
                    if (!sizeVariant.size || sizeVariant.size.trim() === '') {
                        errors.push(`Size is required for size variant #${j + 1} of color #${i + 1}.`);
                    }
                    if (isNaN(parseFloat(sizeVariant.price)) || parseFloat(sizeVariant.price) < 0) {
                        errors.push(`Price must be a positive number for size variant #${j + 1} of color #${i + 1}.`);
                    }
                    if (isNaN(parseInt(sizeVariant.stock)) || parseInt(sizeVariant.stock) < 0) {
                        errors.push(`Stock must be a positive number for size variant #${j + 1} of color #${i + 1}.`);
                    }
                });
            }
        });

        if (errors.length > 0) {
            return res.status(400).json({ message: 'Validation failed', errors: errors });
        }
        const productToUpdate = await Product.findById(productId);
        if (!productToUpdate) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        productToUpdate.title = title;
        productToUpdate.description = description;
        productToUpdate.warranty = warranty;
        productToUpdate.category_id = category_id;
        productToUpdate.brand_id = brand_id;
        const imagesToDelete = JSON.parse(deletedImages);
        if (imagesToDelete && imagesToDelete.length > 0) {
        }
        const updatedColorVariants = [];
        if (colorVariants && Array.isArray(colorVariants)) {
            for (const variant of colorVariants) {
                 const newImages = req.files.filter(file => file.fieldname === `colorVariants[${colorVariants.indexOf(variant)}][images]`);
                let existingVariant = variant.colorId ? productToUpdate.colorVariants.id(variant.colorId) : null;
                if (existingVariant) {
                    existingVariant.colorName = variant.colorName;
                    existingVariant.variants = variant.variants;
                    if (newImages && newImages.length > 0) {
                         const newImageUrls = newImages.map(file => `/uploads/products/${file.filename}`);
                         existingVariant.images = existingVariant.images.concat(newImageUrls);
                    }
                } else {
                     const newVariant = {
                         colorName: variant.colorName,
                         variants: variant.variants,
                         images: newImages.map(file => `/uploads/products/${file.filename}`)
                     };
                     productToUpdate.colorVariants.push(newVariant);
                }
            }
        }
        await productToUpdate.save();
        res.status(200).json({ message: 'Product updated successfully!' });
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).json({ message: 'Failed to update product.' });
    }
};
