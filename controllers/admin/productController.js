const Product = require('../../model/product.js');
const Category = require('../../model/category.js');
const Brand = require('../../model/brand.js'); 
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');     
const fs = require('fs');        

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../public/uploads/products/');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};
const upload = multer({ storage: storage, fileFilter: fileFilter });
const ITEMS_PER_PAGE = 10;

exports.getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const totalProducts = await Product.countDocuments({ isDeleted: false });
        const totalPages = Math.ceil(totalProducts / limit);
        const products = await Product.find({ isDeleted: false })
            .populate('category_id')
            .populate('brand_id')
            .skip(skip)
            .limit(limit)
            .lean();
        const formattedProducts = products.map(p => {
            let minPrice = Infinity;
            let displayImageUrl = '/images/placeholder.png';
            if (p.colorVariants && p.colorVariants.length > 0) {
                p.colorVariants.forEach(colorVariant => {
                    if (displayImageUrl === '/images/placeholder.png' && colorVariant.images && colorVariant.images.length > 0) {
                        displayImageUrl = `/uploads/products/${colorVariant.images[0]}`;
                    }
                    if (colorVariant.variants && colorVariant.variants.length > 0) {
                        colorVariant.variants.forEach(sizeVariant => {
                            if (sizeVariant.price && typeof sizeVariant.price === 'number' && sizeVariant.price < minPrice) {
                                minPrice = sizeVariant.price;
                            }
                        });
                    }
                });
            } else if (p.images && p.images.length > 0) {
                displayImageUrl = `/uploads/products/${p.images[0]}`;
            }
            return {
                ...p,
                category_name: p.category_id?.name || "N/A",
                brand_name: p.brand_id?.name || "N/A",
                category_id: p.category_id?._id?.toString(),
                brand_id: p.brand_id?._id?.toString(),
                min_price: minPrice !== Infinity ? minPrice : undefined,
                display_image_url: displayImageUrl,
            };
        });

        res.render('admin/products', {
            products: formattedProducts,
            currentPage: page,    
            totalPages: totalPages,
            categories: await Category.find().lean(),
            brands: await Brand.find().lean() ,     
            layout:false
        });

    } catch (error) {
        console.error("Error in getAllProducts:", error);
        res.status(500).render('error', { message: 'Failed to load products.' });
    }
};
exports.uploadProductImage = upload.single('image');

exports.softDelete = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndUpdate(id, { isDeleted: true }, { new: true });

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }
        res.json({ success: true, message: 'Product soft deleted successfully!', product });
    } catch (error) {
        console.error("Error soft deleting product:", error);
        res.status(500).json({ success: false, message: 'Failed to soft delete product.' });
    }
};

exports.softRestore = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByIdAndUpdate(id, { isDeleted: false }, { new: true });

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }
        res.json({ success: true, message: 'Product restored successfully!', product });
    } catch (error) {
        console.error("Error restoring product:", error);
        res.status(500).json({ success: false, message: 'Failed to restore product.' });
    }
};

exports.getProductsAjax = async (req, res) => {
    try {
        const searchQuery = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 5; 
        const skip = (page - 1) * limit;
        const baseQuery = {
            isDeleted: false 
        };
        if (searchQuery) {
            baseQuery.title = { $regex: searchQuery, $options: 'i' };
        }
        const totalProducts = await Product.countDocuments(baseQuery);
        const totalPages = Math.ceil(totalProducts / limit);
        const products = await Product.find(baseQuery)
            .populate('category_id')
            .populate('brand_id')
            .skip(skip)
            .limit(limit)
            .lean();
        const formattedProducts = products.map(p => {
            let minPrice = Infinity;
            let displayImageUrl = '/images/placeholder.png';
            if (p.colorVariants && p.colorVariants.length > 0) {
                p.colorVariants.forEach(colorVariant => {
                    if (displayImageUrl === '/images/placeholder.png' && colorVariant.images && colorVariant.images.length > 0) {
                        displayImageUrl = `/uploads/products/${colorVariant.images[0]}`;
                    }
                    if (colorVariant.variants && colorVariant.variants.length > 0) {
                        colorVariant.variants.forEach(sizeVariant => {
                            if (sizeVariant.price && typeof sizeVariant.price === 'number' && sizeVariant.price < minPrice) {
                                minPrice = sizeVariant.price;
                            }
                        });
                    }
                });
            } else if (p.images && p.images.length > 0) {
                displayImageUrl = `/uploads/products/${p.images[0]}`;
            }
            return {
                ...p,
                category_name: p.category_id?.name || "N/A",
                brand_name: p.brand_id?.name || "N/A",
                category_id: p.category_id?._id?.toString(),
                brand_id: p.brand_id?._id?.toString(),
                min_price: minPrice !== Infinity ? minPrice : undefined,
                display_image_url: displayImageUrl,
            };
        });
        res.json({
            products: formattedProducts,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error("Error in searchProducts:", error);
        res.status(500).json({ message: "Error during product search." });
    }
};