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
        // Create the directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename for the uploaded image using timestamp and original name
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});

// Filter to accept only image files
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });
// --- END MULTER SETUP ---


// 📄 GET /admin/products
const ITEMS_PER_PAGE = 10;

exports.getAllProducts = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    try {
        // Fetch total count for pagination
        const total = await Product.countDocuments();

        // Fetch products, populate category and brand, and convert to plain JS objects
        const products = await Product.find()
            .skip((page - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .populate("category_id") // Populate category details
            .populate("brand_id")     // Populate brand details
            .lean(); // Use .lean() for better performance as we're not saving these docs back

        // Fetch all categories and brands for the dropdowns in the modal
        const categories = await Category.find({}).lean();
        const brands = await Brand.find({}).lean();

        // Format products to include derived fields like category_name, brand_name, min_price, and display_image_url
        const formattedProducts = products.map(p => {
            let minPrice = Infinity;
            let displayImageUrl = '/images/placeholder.png'; // Default placeholder image

            if (p.variants && p.variants.length > 0) {
                // Find minimum price from the first variant's sizes
                if (p.variants[0].sizes && p.variants[0].sizes.length > 0) {
                    p.variants[0].sizes.forEach(size => {
                        if (size.price && typeof size.price === 'number' && size.price < minPrice) {
                            minPrice = size.price;
                        }
                    });
                }
                // Get display image from the first variant's images
                if (p.variants[0].images && p.variants[0].images.length > 0) {
                    displayImageUrl = p.variants[0].images[0];
                }
            } else if (p.images && p.images.length > 0) { // Fallback if no variants or variant images
                displayImageUrl = p.images[0];
            }


            return {
                ...p, // Spread all existing properties from the product document
                category_name: p.category_id?.name || "N/A", // Get category name from populated object
                brand_name: p.brand_id?.name || "N/A",       // Get brand name from populated object
                category_id: p.category_id?._id?.toString(), // Pass category ID (as string) for dropdown selection
                brand_id: p.brand_id?._id?.toString(),       // Pass brand ID (as string) for dropdown selection
                min_price: minPrice !== Infinity ? minPrice : undefined, // Pass calculated min price for modal
                display_image_url: displayImageUrl, // Pass selected image URL for modal preview
            };
        });

        res.render("admin/products", { // Ensure this matches your EJS file name: admin/products.ejs
            products: formattedProducts,
            currentPage: page,
            totalPages: Math.ceil(total / ITEMS_PER_PAGE),
            categories, // Pass all categories to EJS for dropdowns
            brands,     // Pass all brands to EJS for dropdowns
            layout: false
        });
    } catch (error) {
        console.error("Error in getAllProducts:", error);
        res.status(500).send("Error loading products.");
    }
};


// Middleware for image upload (to be used in routes)
exports.uploadProductImage = upload.single('image');

// 📄 POST /admin/products/edit/:id
exports.editProduct = async (req, res) => {
    const productId = req.params.id;
    // Destructure new fields from req.body and get the uploaded file from req.file
    const { title, price, category_id, brand_id } = req.body;
    const imageFile = req.file;

    try {
        // Find the product by ID
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send('Product not found.');
        }

        // 1. Update basic fields
        product.title = title;
        product.category_id = category_id;
        product.brand_id = brand_id;

        // 2. Update Price Logic: Apply the new price to all sizes of the first variant
        if (price !== undefined && product.variants && product.variants.length > 0) {
            if (product.variants[0] && product.variants[0].sizes) {
                const newPrice = parseFloat(price); // Convert price to a number
                product.variants[0].sizes.forEach(size => {
                    size.price = newPrice; // Update price for each size in the first variant
                });
            }
        }

        // 3. Handle Image Update
        if (imageFile) {
            const newImagePath = `/uploads/products/${imageFile.filename}`; // Path relative to public folder

            // Determine the old image path to delete it
            let oldImagePath = null;
            if (product.variants && product.variants.length > 0 && product.variants[0].images && product.variants[0].images.length > 0) {
                oldImagePath = product.variants[0].images[0];
            } else if (product.images && product.images.length > 0) {
                oldImagePath = product.images[0];
            }

            // Update image path in the product document
            if (product.variants && product.variants.length > 0) {
                if (!product.variants[0].images) {
                    product.variants[0].images = []; // Initialize if it doesn't exist
                }
                product.variants[0].images[0] = newImagePath; // Update the first image of the first variant
            } else {
                // Fallback: If product doesn't have variants or images are top-level
                if (!product.images) {
                    product.images = []; // Initialize if it doesn't exist
                }
                product.images[0] = newImagePath; // Update the first top-level image
            }

            // Delete the old image file from the server
            if (oldImagePath && oldImagePath !== '/images/placeholder.png') { // Avoid deleting placeholder
                const fullOldPath = path.join(__dirname, '../../public', oldImagePath);
                fs.unlink(fullOldPath, (err) => {
                    if (err) {
                        console.error("Error deleting old image:", err);
                    } else {
                        console.log("Old image deleted:", fullOldPath);
                    }
                });
            }
        }

        // Save the updated product document
        await product.save();

        // Optional: Use flash messages for user feedback if you have connect-flash
        // req.flash('success', 'Product updated successfully!');
        res.redirect('/admin/products');
    } catch (error) {
        console.error("Error editing product:", error);
        // req.flash('error', 'Failed to update product.');
        res.status(500).send('Error updating product.');
    }
};

exports.softDelete = async (req, res) => {
    const page = req.query.page || 1; 
    try {
        console.log(req.params.id)
        await Product.findByIdAndUpdate(req.params.id, { isDeleted: true });
        // req.flash('success', 'Product soft deleted successfully!');
        res.redirect(`/admin/products?page=${page}`); // Redirect back to the same page
    } catch (error) {
        console.error("Error soft deleting product:", error);
        // req.flash('error', 'Failed to soft delete product.');
        res.redirect(`/admin/products?page=${page}`);
    }
};

exports.softRestore = async (req, res) => {
    const page = req.query.page || 1; // Get current page for redirection
    try {
        await Product.findByIdAndUpdate(req.params.id, { isDeleted: false });
        // req.flash('success', 'Product restored successfully!');
        res.redirect(`/admin/products?page=${page}`); // Redirect back to the same page
    } catch (error) {
        console.error("Error restoring product:", error);
        // req.flash('error', 'Failed to restore product.');
        res.redirect(`/admin/products?page=${page}`);
    }
};


exports.getProductsAjax = async (req, res) => {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    console.log("🛬 SEARCH HIT:", search);

    // Build the search query
    // To search on populated fields (category and brand names),
    // you need to populate them first and then use dot notation in the query.
    // However, for direct MongoDB queries (like in `countDocuments`), you generally can't
    // directly query on populated fields unless they are denormalized.
    // For this specific AJAX search, we will perform the population and then filter.

    // Start with a base query (e.g., if you want to include all products by default)
    let query = {};

    // If a search term is provided, build the $or query
    if (search) {
        // Mongoose allows querying on populated fields using dot notation directly in find().
        // It's more efficient to populate *before* the find query if you're only searching
        // on the populated fields themselves.
        query = {
            $or: [
                { title: { $regex: search, $options: 'i' } },
                // These conditions will work because we are populating later.
                // However, for the `countDocuments(query)` to work correctly with populated fields
                // you might need to reconsider your search strategy (e.g., denormalize names,
                // or perform a two-step query: find IDs based on populated search, then count those IDs).
                // For simplicity here, we'll assume direct string search on category/brand name might
                // not be perfectly accurate if the category_name/brand_name isn't stored directly
                // on the product (which is usually the case when using references).
                // The provided query `category_name: { $regex: search, $options: 'i' }`
                // in your original `getProductsAjax` implies category_name might be denormalized or
                // handled differently. If category/brand names are only in their respective collections
                // and you want to search them, you'd need a more advanced aggregation pipeline with $lookup.
                // For now, I'll modify it to search on 'category_id.name' and 'brand_id.name'
                // which means the population *must* happen before the query is executed.
                // Also, removed `regular_price` as it's no longer a top-level field.
                { 'category_id.name': { $regex: search, $options: 'i' } },
                { 'brand_id.name': { $regex: search, $options: 'i' } }
            ]
        };
        // If the search term is a number, we can also search in variants' prices
        const isNumber = !isNaN(parseFloat(search)) && isFinite(search);
        if (isNumber) {
            query.$or.push({ 'variants.sizes.price': parseFloat(search) });
        }
    }


    try {
        // Fetch products, populate category and brand for search and display
        const products = await Product.find(query)
            .populate("category_id") // Needed for searching by category name and getting category_id
            .populate("brand_id")   // Needed for searching by brand name and getting brand_id
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(); // Use .lean() for better performance

        // Total count based on the search query (might need adjustment for complex populated field searches)
        // Note: countDocuments() on a query with populated field direct string search like {'category_id.name': ...}
        // will not work correctly *unless* you first populate and then filter in memory, or use aggregation.
        // For accurate total count on populated fields with search, a $lookup aggregation is generally needed.
        // For simplicity, for now, this count will be based on non-populated fields or direct product fields.
        const totalProducts = await Product.countDocuments(query);


        // Format products for the AJAX response
        const formattedProducts = products.map((p) => {
            let minPrice = Infinity;
            let displayImageUrl = '/images/placeholder.png';

            if (p.variants && p.variants.length > 0) {
                if (p.variants[0].sizes && p.variants[0].sizes.length > 0) {
                    p.variants[0].sizes.forEach(size => {
                        if (size.price && typeof size.price === 'number' && size.price < minPrice) {
                            minPrice = size.price;
                        }
                    });
                }
                if (p.variants[0].images && p.variants[0].images.length > 0) {
                    displayImageUrl = p.variants[0].images[0];
                }
            } else if (p.images && p.images.length > 0) {
                displayImageUrl = p.images[0];
            }

            return {
                _id: p._id,
                title: p.title,
                min_price: minPrice !== Infinity ? minPrice : undefined, // Send min price
                category_name: p.category_id?.name || 'N/A', // Get category name from populated object
                brand_name: p.brand_id?.name || 'N/A',     // Get brand name from populated object
                category_id: p.category_id?._id?.toString(), // Send category ID for re-rendering edit buttons
                brand_id: p.brand_id?._id?.toString(),       // Send brand ID for re-rendering edit buttons
                display_image_url: displayImageUrl, // Send image URL for re-rendering edit buttons
                createdAt: p.createdAt,
                isDeleted: p.isDeleted || false, // Use isDeleted consistently
            };
        });

        res.json({ products: formattedProducts, totalProducts }); // Send totalProducts for potential client-side pagination update
    } catch (err) {
        console.error("💥 Search error:", err.message);
        res.status(500).json({ error: 'Search failed' });
    }
};