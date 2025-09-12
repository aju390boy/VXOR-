const Product = require("../../model/product.js");
const Category = require("../../model/category.js");
const Brand = require("../../model/brand.js");
const mongoose = require("mongoose");
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
    const product = await Product.findById(productId)
      .populate("category_id")
      .populate("brand_id")
      .lean();
    if (!product || product.isDeleted) {
      return res.status(404).send("Product not found or is deleted.");
    }
    const bestOffer = await findBestOffer(product._id, product.category_id?._id, product.brand_id?._id);
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

    const similarProducts = findSimilarProducts(product, allOtherProductsWithOffers);
      let initialDisplayPrice = 0;
        let initialImages = [];
        let initialAvailableSizes = []; // This array is correctly calculated here
        if (product.colorVariants && product.colorVariants.length > 0) {
            const defaultColorVariant = product.colorVariants[0];
            initialDisplayPrice = defaultColorVariant.variants[0]?.price || 0;
            initialImages = (defaultColorVariant.images || []).map(img => `/uploads/products/${img}`);
            initialAvailableSizes = defaultColorVariant.variants.map(v => v.size);
        }
        if (initialImages.length === 0) initialImages.push("/images/placeholder.png");

        res.render("user/productDetail", {
            product: {
                ...product, 
                display_price: initialDisplayPrice,
                images: initialImages,
                sizes: initialAvailableSizes // <-- FIXED: Added this line back
            },
            bestOffer, 
            similarProducts: similarProducts,
            title: product.title || "Product Details",
        });
  } catch (err) {
    console.error("Product Detail Error:", err);
    if (!res.headersSent) {
      res.status(500).send("Server Error fetching product details.");
    }
  }
};
