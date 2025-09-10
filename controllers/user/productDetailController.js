const Product = require("../../model/product.js");
const Category = require("../../model/category.js");
const Brand = require("../../model/brand.js");
const mongoose = require("mongoose");

function findSimilarProducts(currentProduct, allProducts) {
  const similarProducts = [];
  const priceRange = 0.3; // 30% price range

  // Get a simple array of color names for the current product
  const currentColorNames = currentProduct.colorVariants.map(
    (variant) => variant.colorName
  );

  for (const product of allProducts) {
    let score = 0;

    // +10 points for the same category
    if (
      product.category_id.toString() ===
      currentProduct.category_id._id.toString()
    ) {
      score += 10;
    }

    // +7 points for the same brand
    if (
      product.brand_id.toString() === currentProduct.brand_id._id.toString()
    ) {
      score += 7;
    }
    // +5 points for being in the price range (using min_price)
    const priceDifference = Math.abs(
      product.min_price - currentProduct.min_price
    );
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

  // Return the top 4 product documents
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
    const allOtherProducts = await Product.find({
      _id: { $ne: productId },
      isListed: true,
      isDeleted: false,
    }).lean();
    const similarProducts = findSimilarProducts(product, allOtherProducts);
    let initialDisplayPrice = 0;
    let initialRegularPrice = 0;
    let initialImages = [];
    let initialAvailableSizes = [];
    if (product.colorVariants && product.colorVariants.length > 0) {
      const defaultColorVariant = product.colorVariants[0];
      if (
        defaultColorVariant.images &&
        Array.isArray(defaultColorVariant.images)
      ) {
        initialImages = defaultColorVariant.images.map(
          (img) => `/uploads/products/${img}`
        );
      } else {
        initialImages.push("/images/placeholder.png");
      }
      let minPriceForDefaultVariant = Infinity;
      let maxPriceForDefaultVariant = 0;
      if (
        defaultColorVariant.variants &&
        Array.isArray(defaultColorVariant.variants)
      ) {
        defaultColorVariant.variants.forEach((sizeVariant) => {
          if (sizeVariant.price < minPriceForDefaultVariant)
            minPriceForDefaultVariant = sizeVariant.price;
          if (sizeVariant.price > maxPriceForDefaultVariant)
            maxPriceForDefaultVariant = sizeVariant.price;
          if (
            sizeVariant.size &&
            !initialAvailableSizes.includes(sizeVariant.size)
          ) {
            initialAvailableSizes.push(sizeVariant.size);
          }
        });
      }
      initialDisplayPrice =
        minPriceForDefaultVariant === Infinity ? 0 : minPriceForDefaultVariant;
      initialRegularPrice = maxPriceForDefaultVariant;
    } else {
      initialImages.push("/images/placeholder.png");
    }
    res.render("user/productDetail", {
      product: {
        _id: product._id,
        title: product.title,
        description: product.description,
        rating: product.rating || 0,
        display_price: parseFloat(initialDisplayPrice) || 0,
        regular_price: parseFloat(initialRegularPrice) || 0,
        images: initialImages,
        colorVariants: product.colorVariants,
        sizes: initialAvailableSizes,
        warranty: product.warranty,
        category_id: product.category_id,
        brand_id: product.brand_id,
      },
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
