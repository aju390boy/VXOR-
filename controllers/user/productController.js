const Product = require('../../model/product.js');
const User = require('../../model/user.js'); 
const Category = require('../../model/category.js');
const Brand = require('../../model/brand.js'); 
const mongoose = require('mongoose');


const formatProductForListing = (product) => {
    let displayPrice = null;
    let displayImageUrl = '/uploads/products/placeholder.png';

  
    if (product.colorVariants && product.colorVariants.length > 0) {
        let minPrice = Infinity;

        
        product.colorVariants.forEach(colorVariant => {
            
            if (colorVariant.images && colorVariant.images.length > 0) {
               
                if (displayImageUrl === '/uploads/products/placeholder.png') {
                    displayImageUrl = `/uploads/products/${colorVariant.images[0]}`;
                }
            }

            
            if (colorVariant.variants && colorVariant.variants.length > 0) {
                colorVariant.variants.forEach(sizeVariant => {
                    if (sizeVariant.price !== undefined && typeof sizeVariant.price === 'number' && sizeVariant.price < minPrice) {
                        minPrice = sizeVariant.price;
                    }
                });
            }
        });

        
        displayPrice = minPrice !== Infinity ? minPrice : null;
    }

    return {
        _id: product._id,
        title: product.title,
        rating: product.rating || 0,
        display_price: displayPrice,
        display_image_url: displayImageUrl,
    };
};


exports.getAllProducts = async (req, res) => {
    try {
        const { category, brand, price, rating, color, size, sort } = req.query;
        console.log({ category, brand, price, rating, color, size, sort })

        let queryObj = { isDeleted: false };
        let sortOption = {};

        
        if (category) {
            const categoriesToFind = Array.isArray(category) ? category : [category];
            
            const categoryDocs = await Category.find({ name: { $in: categoriesToFind } }).select('_id').lean();
            const categoryIds = categoryDocs.map(doc => doc._id);
            if (categoryIds.length > 0) {
                queryObj.category_id = { $in: categoryIds };
            } else {
                
                queryObj.category_id = null;
            }
        }

        
        if (brand) {
            const brandsToFind = Array.isArray(brand) ? brand : [brand];
            
            const brandDocs = await Brand.find({ name: { $in: brandsToFind } }).select('_id').lean();
            const brandIds = brandDocs.map(doc => doc._id);
            if (brandIds.length > 0) {
                queryObj.brand_id = { $in: brandIds };
            } else {
              
                queryObj.brand_id = null;
            }
        }

       
        if (price) {
    const maxPrice = parseFloat(price);
    if (!isNaN(maxPrice)) {
        queryObj.min_price = { $lte: maxPrice };
    }
}

        
        if (rating) {
    const selectedRatings = Array.isArray(rating) ? rating.map(Number) : [Number(rating)];
    if (selectedRatings.length > 0) {
        queryObj.rating = { $gte: Math.min(...selectedRatings) };
    }
}

       
       if (color) {
    const colors = Array.isArray(color) ? color : [color];
   
    queryObj['colorVariants.colorName'] = { $in: colors };
}

        
        if (size) {
    const sizes = Array.isArray(size) ? size : [size];
   
    queryObj['colorVariants.variants.size'] = { $in: sizes };
}

        
        if (sort === 'price_asc') {
            
            sortOption.min_price = 1;
        } else if (sort === 'price_desc') {
            sortOption.min_price = -1;
        } else if (sort === 'name_asc') {
            sortOption.title = 1;
        } else if (sort === 'name_desc') {
            sortOption.title = -1;
        } else if (sort === 'newest') {
            sortOption.createdAt = -1;
        } else {
            sortOption.createdAt = -1;
        }

        const products = await Product.find(queryObj)
                                       .sort(sortOption)
                                       .lean();

        const formattedProducts = products.map(formatProductForListing);

        const displaySortOptions = [
            { value: 'newest', label: 'Newest Arrivals' },
            { value: 'price_asc', label: 'Price: Low to High' },
            { value: 'price_desc', label: 'Price: High to Low' },
            { value: 'name_asc', label: 'Name: A-Z' },
            { value: 'name_desc', label: 'Name: Z-A' }
        ];

        if (req.xhr || req.headers.accept.includes('application/json')) {
            const html = formattedProducts.length > 0 ? formattedProducts.map(item => `
                <a href="/user/product/${item._id}" class="item-link no-underline text-inherit">
                  <div class="item-block border border-gray-800 rounded-lg overflow-hidden hover:scale-105 transition bg-ye-500">
                    <div class="product">
                      <img src="${item.display_image_url}" alt="${item.title}" class="w-full h-60 object-cover">
                    </div>
                    <div class="p-2 text-center">
                      <p class="font-bold text-white text-xs">${item.title}</p>
                      <p class="text-gray-400 font-bold text-xs">₹${item.display_price != null ? item.display_price.toFixed(2) : 'N/A'}</p>
                      <p class="text-xs">Rating: ${'⭐'.repeat(item.rating) + (item.rating < 5 ? '☆' : '')}</p>
                    </div>
                  </div>
                </a>
            `).join('') : '<p class="text-white text-center w-full col-span-full text-sm font-bold">No products match your filters</p>';
            res.json({ html: html });
        } else {
            res.render('user/product', {
                products: formattedProducts,
                sortOptions: displaySortOptions,
                title: 'VIXOR | Products',
                query: req.query
            });
        }

    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send('Server Error');
    }
};

////search Section\\\\
exports.liveSearch = async (req, res) => {
    const query = req.query.q;

    if (!query) return res.json([]);

    try {
        const rawResults = await Product.find({
            title: { $regex: query, $options: 'i' },
            isDeleted: false // Only show non-deleted products in search
        })
        .limit(5)
        .select('title variants images rating') // Select necessary fields for formatting
        .lean(); // Fetch as plain JS objects

        // Format results
        const formattedResults = rawResults.map(formatProductForListing);

        res.json(formattedResults);
    } catch (err) {
        console.error("🔴 Live Search Error:", err.message);
        res.status(500).json([]);
    }
};