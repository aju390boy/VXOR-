const Product = require("../../model/product.js");
const Category = require("../../model/category.js");
const Brand = require("../../model/brand.js");
const mongoose = require("mongoose");
const Wishlist = require('../../model/wishlist.js');
const {findBestOffer} = require('../../utils/offerHelper.js');

function findSimilarProducts(currentProduct, allProducts) {
  const similarProducts = [];
  const priceRange = 0.3; 
  const currentColorNames = currentProduct.colorVariants.map(
    (variant) => variant.colorName
  );
  for (const product of allProducts) {
    let score = 0;
    if ( product.category_id && product.category_id.toString() === currentProduct.category_id._id.toString()) {
      score += 10;
    }
    if ( product.brand_id && product.brand_id.toString() === currentProduct.brand_id._id.toString()) {
      score += 7;
    }
    const priceDifference = Math.abs(product.min_price - currentProduct.min_price );
    if (priceDifference <= currentProduct.min_price * priceRange) {
      score += 5;
    }
    const productColors = product.colorVariants.map((v) => v.colorName);
    const hasCommonColor = currentColorNames.some((color) =>
      productColors.includes(color)
    );
    if (hasCommonColor) {
      score += 3;
    }
    if (score > 0) {
      similarProducts.push({ product, score });
    }
  }
  similarProducts.sort((a, b) => b.score - a.score);
  return similarProducts.slice(0, 4).map((item) => item.product);
}

///Product Detailing\\\
exports.getSingleProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const wishlist = await Wishlist.findOne({ user_id: req.user._id }).lean();
    const wishlistProductIds = wishlist ? wishlist.products.map(p => p.product_id.toString()) : [];

    // Fetch product and related data
    const product = await Product.findById(productId)
      .populate("category_id")
      .populate("brand_id")
      .lean();

    if (!product || product.isDeleted) {
      return res.status(404).send("Product not found or is deleted.");
    }

    // Compute best offer for main product
    const bestOffer = await findBestOffer(product._id, product.category_id?._id, product.brand_id?._id);

    // Fetch and attach best offers to other products
    const allOtherProducts = await Product.find({
      _id: { $ne: productId },
      isListed: true,
      isDeleted: false,
    })
      .populate('category_id')
      .populate('brand_id')
      .lean();

    const allOtherProductsWithOffers = await Promise.all(
      allOtherProducts.map(async (p) => {
        const offer = await findBestOffer(p._id, p.category_id?._id, p.brand_id?._id);
        return { ...p, bestOffer: offer }; 
      })
    );

    // Find similar products
    const similarProducts = findSimilarProducts(product, allOtherProductsWithOffers);

    // Gather all Cloudinary images from all color variants
    let initialImages = [];
if (product.colorVariants && product.colorVariants.length > 0) {
  product.colorVariants.forEach(variant => {
    if (Array.isArray(variant.images)) {
      variant.images.forEach(img => {
        if (typeof img === 'string') {
          if (img.startsWith('http')) {
            initialImages.push(img); // Cloudinary URL: push as is
          } else {
            // Only add prefix if it's a filename (legacy)
            initialImages.push(`/uploads/products/${img}`);
          }
        }
      });
    }
  });
}
if (initialImages.length === 0) initialImages.push("/images/placeholder.png");



    console.log(`initial images : ${initialImages}`);

    // Show price/sizes for the first color by default (can be improved for UX)
    let initialDisplayPrice = 0;
    let initialAvailableSizes = [];
    if (product.colorVariants && product.colorVariants.length > 0) {
      const defaultColorVariant = product.colorVariants[0];
      initialDisplayPrice = defaultColorVariant.variants && defaultColorVariant.variants[0]?.price || 0;
      initialAvailableSizes = defaultColorVariant.variants
        ? defaultColorVariant.variants.map(v => v.size)
        : [];
    }

    res.render("user/productDetail", {
      product: {
        ...product, 
        display_price: initialDisplayPrice,
        images: initialImages,
        sizes: initialAvailableSizes
      },
      bestOffer,
      similarProducts,
      wishlistIds: wishlistProductIds,
      title: product.title || "Product Details",
    });
  } catch (err) {
    console.error("Product Detail Error:", err);
    if (!res.headersSent) {
      res.status(500).send("Server Error fetching product details.");
    }
  }
};
