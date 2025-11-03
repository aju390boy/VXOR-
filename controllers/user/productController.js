const Product = require("../../model/product.js");
const User = require("../../model/user.js");
const Category = require("../../model/category.js");
const Brand = require("../../model/brand.js");
const mongoose = require("mongoose");
const Wishlist = require('../../model/wishlist.js');
const {findBestOffer} = require('../../utils/offerHelper.js');


const formatProductForListing = (product, bestOffer = null) => {
    let displayImageUrl = "/uploads/products/placeholder.png";
    let minPrice = product.min_price || product.computed_min_price || 0;
    if (product.colorVariants?.[0]?.images?.[0]) {
        displayImageUrl = `/uploads/products/${product.colorVariants[0].images[0]}`;
    }
    let discountedPrice = null;
    if (bestOffer && minPrice > 0) {
        discountedPrice = minPrice * (1 - bestOffer.discountPercentage / 100);
    }
    return {
        ...product,
        display_price: minPrice,
        discounted_price: discountedPrice ? discountedPrice.toFixed(0) : null,
        display_image_url: displayImageUrl,
        bestOffer: bestOffer
    };
};

exports.getAllProducts = async (req, res) => {
  try {
    const { category, brand, price, rating, color, size, sort } = req.query;
    const wishlist = await Wishlist.findOne({ user_id: req.user._id }).lean();
    const wishlistProductIds = wishlist ? wishlist.products.map(p => p.product_id.toString()) : [];
    let queryObj = { isDeleted: false, isListed: true };
    let pipeline = [{ $match: queryObj }];

    if (category) {
      const categoriesToFind = Array.isArray(category) ? category : [category];
      const categoryDocs = await Category.find({
        name: { $in: categoriesToFind },
      })
        .select("_id")
        .lean();
      const categoryIds = categoryDocs.map((doc) => doc._id);
      if (categoryIds.length > 0) {
        pipeline[0].$match.category_id = { $in: categoryIds };
      }
    }
    if (brand) {
      const brandsToFind = Array.isArray(brand) ? brand : [brand];
      const brandDocs = await Brand.find({ name: { $in: brandsToFind } })
        .select("_id")
        .lean();
      const brandIds = brandDocs.map((doc) => doc._id);
      if (brandIds.length > 0) {
        pipeline[0].$match.brand_id = { $in: brandIds };
      }
    }
    if (rating) {
      const selectedRatings = Array.isArray(rating)
        ? rating.map(Number)
        : [Number(rating)];
      if (selectedRatings.length > 0) {
        pipeline[0].$match.rating = { $in: selectedRatings };
      }
    }
    if (color || size) {
      const colorMatch = color
        ? { colorName: { $in: Array.isArray(color) ? color : [color] } }
        : {};
      const sizeMatch = size
        ? { "variants.size": { $in: Array.isArray(size) ? size : [size] } }
        : {};
      pipeline[0].$match.colorVariants = {
        $elemMatch: { ...colorMatch, ...sizeMatch },
      };
    }
    pipeline.push({
      $addFields: {
        computed_min_price: {
          $min: {
            $reduce: {
              input: "$colorVariants.variants",
              initialValue: [],
              in: { $concatArrays: ["$$value", "$$this.price"] },
            },
          },
        },
      },
    });
    if (price) {
      const maxPrice = parseFloat(price);
      if (!isNaN(maxPrice) && maxPrice > 0) {
        pipeline.push({
          $match: {
            computed_min_price: { $lte: maxPrice, $gt: 0 },
          },
        });
      }
    }
    let sortOption = {};
    if (sort === "price_asc") {
      sortOption.computed_min_price = 1;
    } else if (sort === "price_desc") {
      sortOption.computed_min_price = -1;
    } else if (sort === "name_asc") {
      sortOption.title = 1;
    } else if (sort === "name_desc") {
      sortOption.title = -1;
    } else {
      sortOption.createdAt = -1;
    }
    pipeline.push({ $sort: sortOption });
    const products = await Product.aggregate(pipeline).exec();
 const productsWithOffers = await Promise.all(
            products.map(async (product) => {
                const populatedProduct = await Product.findById(product._id).populate('category_id').populate('brand_id').lean();
                const bestOffer = await findBestOffer(populatedProduct._id, populatedProduct.category_id?._id, populatedProduct.brand_id?._id);
                return { ...product, bestOffer }; 
            })
        );
     const formattedProducts = productsWithOffers.map(product => formatProductForListing(product, product.bestOffer));
    const displaySortOptions = [
      { value: "newest", label: "Newest Arrivals" },
      { value: "price_asc", label: "Price: Low to High" },
      { value: "price_desc", label: "Price: High to Low" },
      { value: "name_asc", label: "Name: A-Z" },
      { value: "name_desc", label: "Name: Z-A" },
    ];
   if (req.xhr || req.headers.accept.includes("application/json")) {
    const html = formattedProducts.length > 0
        ? formattedProducts.map(item => `
            <a href="/user/product/${item._id}" class="item-link no-underline text-inherit">
              <div class="item-block border border-gray-800 rounded-lg overflow-hidden hover:scale-105 transition bg-black-400">
                <div class="product">
                  <img src="${item.display_image_url}" alt="${item.title}" class="w-full h-60 object-cover">
                </div>
                <div class="p-2 text-center">
                  <p class="font-bold text-white text-xs">${item.title}</p>
                  
                  <div class="text-gray-400 font-bold text-xs">
                    ${item.bestOffer ? `
                      <s class="text-gray-500">₹${item.display_price.toFixed(0)}</s>
                      <span class="text-red-500">₹${item.discounted_price}</span>
                    ` : `
                      <span>₹${item.display_price != null ? item.display_price.toFixed(0) : 'N/A'}</span>
                    `}
                  </div>

                  <p class="text-xs">Rating: ${'⭐'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}</p>
                </div>
              </div>
            </a>
          `).join("")
        : '<p class="text-white text-center w-full col-span-full text-sm font-bold">No products match your filters</p>';
    res.json({ html: html ,wishlistIds: wishlistProductIds});
}else {
      res.render("user/product", {
        products: formattedProducts,
        sortOptions: displaySortOptions,
        title: "VIXOR | Products",
        query: req.query,
        wishlistIds: wishlistProductIds,
      });
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Server Error");
  }
};

////search Section\\\\
exports.liveSearch = async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);
    try {
        const rawResults = await Product.find({
            title: { $regex: query, $options: "i" },
            isDeleted: false,
        })
        .limit(5)
        .populate('category_id') 
        .populate('brand_id')
        .lean();
        const resultsWithOffers = await Promise.all(
            rawResults.map(async (product) => {
                const bestOffer = await findBestOffer(product._id, product.category_id?._id, product.brand_id?._id);
                return { ...product, bestOffer };
            })
        );
        const formattedResults = resultsWithOffers.map(product => 
            formatProductForListing(product, product.bestOffer)
        );
        res.json(formattedResults);
    } catch (err) {
        console.error("🔴 Live Search Error:", err.message);
        res.status(500).json([]);
    }
};

exports.getProductVariants = async (req, res) => {
    try {
        const product = await Product.findById(req.params.productId).select('colorVariants').lean();
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        res.json(product.colorVariants);
    } catch (error) {
        console.error("Error fetching product variants:", error);
        res.status(500).json({ message: 'Server error.' });
    }
};