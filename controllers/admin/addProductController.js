const Product = require("../../model/product.js");
const Brand = require("../../model/brand.js");
const Category = require("../../model/category.js");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const { rmSync } = require("fs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/products");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "product_" + uniqueSuffix + path.extname(file.originalname));
  },
});
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const mimetype = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  if (mimetype && extname) {
    return cb(null, true);
  }
  const error = new Error(
    "Only .jpeg, .jpg, .png, .gif, .webp format allowed!"
  );
  error.code = "FILE_TYPE_ERROR";
  cb(error);
};

exports.upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

///get addproduct page\\\\
exports.getAddProductPage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({});

    res.render("admin/addproducts", { categories, brands, layout: false });
  } catch (err) {
    console.error("Error loading Add Product page:", err.message);
    res.status(500).send("Internal Server Error");
  }
};

// POST /admin/addproducts
exports.addProduct = async (req, res) => {
  try {
    const { title, description, brand_id, warranty, category_id, isListed } =
      req.body;
    const rawColorVariants = req.body.colorVariants;
    const parsedColorVariants = Object.values(rawColorVariants || {});
    const errors = [];
    const containsLetter = /[a-zA-Z]/.test(title);
    const descriptionCheck=/[0-9]/.test(description);


    const [categoryExists, brandExists] = await Promise.all([
      Category.findById(category_id),
      Brand.findById(brand_id),
    ]);
    if (!categoryExists) {
      errors.push("The selected category does not exist.");
    }
    if (!brandExists) {
      errors.push("The selected brand does not exist.");
    }

    if (!title || title.trim().length < 3 || !containsLetter) {
      if (!title || title.trim().length === 0) {
        errors.push("Product title is required.");
      } else if (!containsLetter) {
        errors.push(
          "Product title must contain at least one alphabetical character."
        );
      } else {
        errors.push("Product title must be at least 3 characters long.");
      }
    }
    if(!description || descriptionCheck){
      if(!description || description.trim().length===0){
        errors.push('Product description required');
      }else if(descriptionCheck){
        errors.push('Product description doesnt allowed digits');
      }
    }
    if (!mongoose.Types.ObjectId.isValid(category_id)) {
      errors.push("Invalid category selected.");
    }
    if (!mongoose.Types.ObjectId.isValid(brand_id)) {
      errors.push("Invalid brand selected.");
    }
    if (warranty && (isNaN(parseInt(warranty)) || parseInt(warranty) < 0)) {
      errors.push("Warranty must be a positive number.");
    }
    if (!parsedColorVariants || parsedColorVariants.length === 0) {
      errors.push("At least one color variant is required.");
    }
    if (req.files.length === 0) {
      errors.push("At least one image must be uploaded for the product.");
    }
    if (parsedColorVariants.length > 1) {
      const colorNames = parsedColorVariants.map((variant) =>
        variant.colorName.toLowerCase().trim()
      );
      const uniqueColorNames = new Set(colorNames);

      if (uniqueColorNames.size !== colorNames.length) {
        errors.push(
          "Duplicate color variant names are not allowed. Please use unique names."
        );
      }
    }

    parsedColorVariants.forEach((variant, i) => {
      if (!variant.colorName || variant.colorName.trim() === "") {
        errors.push(`Color name is required for variant #${i + 1}.`);
      }
      if (!variant.variants || Object.keys(variant.variants).length === 0) {
        errors.push(
          `At least one size variant is required for color #${i + 1}.`
        );
      } else {
         const sizeNames = [];
        Object.values(variant.variants).forEach((sizeVariant, j) => {
          if (!sizeVariant.size || sizeVariant.size.trim() === "") {
            errors.push(
              `Size is required for size variant #${j + 1} of color #${i + 1}.`
            );
          }
          const currentSize = sizeVariant.size.trim().toLowerCase();
      if (sizeNames.includes(currentSize)) {
        errors.push(
          `Duplicate size variant "${sizeVariant.size}" found for color #${i + 1}. Each size must be unique.`
        );
      } else {
        sizeNames.push(currentSize);
      }
          if (
            isNaN(parseFloat(sizeVariant.price)) ||
            parseFloat(sizeVariant.price) < 0
          ) {
            errors.push(
              `Price must be a positive number for size variant #${
                j + 1
              } of color #${i + 1}.`
            );
          }
          if (
            isNaN(parseInt(sizeVariant.stock)) ||
            parseInt(sizeVariant.stock) < 0
          ) {
            errors.push(
              `Stock must be a positive number for size variant #${
                j + 1
              } of color #${i + 1}.`
            );
          }
          
        });
      }
    });

    if (errors.length > 0) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors });
    }
    const colorVariants = [];
    for (let i = 0; i < parsedColorVariants.length; i++) {
      const variantData = parsedColorVariants[i];
      const variantColorName = variantData.colorName;
      const variantImages = req.files
        .filter((file) => file.fieldname === `colorVariants[${i}][images]`)
        .map((file) => file.filename);
      const sizesAndStock = [];
      const rawSizeVariants = variantData.variants;
      const parsedSizeVariants = Object.values(rawSizeVariants || {});

      for (let j = 0; j < parsedSizeVariants.length; j++) {
        const sizeData = parsedSizeVariants[j];
        sizesAndStock.push({
          size: sizeData.size,
          price: parseFloat(sizeData.price),
          stock: parseInt(sizeData.stock, 10),
        });
      }
      colorVariants.push({
        colorName: variantColorName,
        images: variantImages,
        variants: sizesAndStock,
      });
    }
    const product = new Product({
      title,
      description,
      brand_id,
      warranty: warranty ? parseInt(warranty, 10) : undefined,
      category_id,
      isListed: isListed === "true",
      colorVariants,
    });
    await product.save();
    res.status(201).json({ message: "Product added successfully!" });
  } catch (err) {
    console.error(" An error occurred while saving the product:", err);
    res.status(500).json({
      message: "An unexpected error occurred during submission.",
      error: err.message,
    });
  }
};

//edit product \\\\
exports.getEditProductPage = async (req, res, next) => {
  try {
    const productId = req.params.id;
    let product = await Product.findById(productId)
      .populate("category_id")
      .populate("brand_id");

    const categories = await Category.find();
    const brands = await Brand.find();

    if (!product) {
      return res
        .status(404)
        .render("admin/404", { message: "Product not found" });
    }

    const productObject = product.toObject();
    productObject.colorVariants = productObject.colorVariants.map((variant) => {
      variant.images = variant.images.map((imageFilename) => {
        return {
          url: `/uploads/products/${imageFilename}`,
          filename: imageFilename,
        };
      });
      return variant;
    });

    res.render("admin/addProducts", {
      product: productObject,
      categories,
      brands,
      layout: false,
    });
  } catch (err) {
    console.error("Error fetching product for edit:", err);
    next(err);
  }
};

//  edit product\\
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const {
      title,
      description,
      warranty,
      category_id,
      brand_id,
      colorVariants,
      deletedImages,
    } = req.body;
    console.log('Product ID:', productId);
    console.log('Received color variants payload:', JSON.stringify(colorVariants, null, 2));
    console.log('Uploaded file fieldnames:', (req.files || []).map(f => f.fieldname));
    console.log('Color variants received with colorIds:', 
      (colorVariants || []).map(v => ({ colorId: v.colorId, colorName: v.colorName }))
    );
    const errors = [];
    if (!mongoose.Types.ObjectId.isValid(productId))
      errors.push('Invalid product ID.');

/////////////////
// Validate related objects existence only if IDs are provided
if (category_id !== undefined && category_id !== '') {
  if (!mongoose.Types.ObjectId.isValid(category_id)) 
    errors.push('Invalid category ID.');
  else {
    const categoryExists = await Category.findById(category_id);
    if (!categoryExists) errors.push('The selected category does not exist.');
  }
}

if (brand_id !== undefined && brand_id !== '') {
  if (!mongoose.Types.ObjectId.isValid(brand_id)) 
    errors.push('Invalid brand ID.');
  else {
    const brandExists = await Brand.findById(brand_id);
    if (!brandExists) errors.push('The selected brand does not exist.');
  }
}

// Validate title if it's provided
if (title !== undefined) {
  if (title.trim().length < 3 || !/[a-zA-Z]/.test(title))
    errors.push('Product title must be at least 3 characters, contain at least one letter.');
}

// Validate description if it's provided
if (description !== undefined) {
  if (description.trim().length === 0) 
    errors.push('Product description is required.');
  if (/[0-9]/.test(description))
    errors.push('Product description should not contain digits.');
}
if (warranty !== undefined && warranty !== '') {
  if (isNaN(parseInt(warranty, 10)) || parseInt(warranty, 10) < 0)
    errors.push('Warranty must be a positive number.');
}

// Validate colorVariants only if provided
if (colorVariants !== undefined) {
  if (!Array.isArray(colorVariants)) {
    errors.push('Color variants must be an array.');
  } else {
    if (colorVariants.length === 0) {
      errors.push('At least one color variant must be provided.');
    }
    colorVariants.forEach((variant, i) => {
      if ('colorName' in variant) {
        if (!variant.colorName || variant.colorName.trim() === '') {
          errors.push(`Color name is required for variant #${i + 1}.`);
        }
      }
      if ('images' in variant) {
        if (!Array.isArray(variant.images)) {
          errors.push(`Images for color #${i + 1} should be an array.`);
        }
      }

      //  Only validate size variants if they are provided
      if ('variants' in variant) {
        const variantsObj = variant.variants;
        if (
          !variantsObj ||
          (typeof variantsObj === 'object' && Object.keys(variantsObj).length === 0)
        ) {
          errors.push(`At least one size variant is required for color #${i + 1}.`);
        } else {
          const sizeNames = [];
          Object.values(variantsObj).forEach((sizeVariant, j) => {
            if ('size' in sizeVariant) {
              if (!sizeVariant.size || sizeVariant.size.trim() === '') {
                errors.push(
                  `Size is required for size #${j + 1} of color #${i + 1}.`
                );
              }
            }

            // Prevent duplicate sizes
            if (sizeVariant.size) {
              const sizeKey = sizeVariant.size.trim().toLowerCase();
              if (sizeNames.includes(sizeKey)) {
                errors.push(
                  `Duplicate size "${sizeVariant.size}" in color #${i + 1}.`
                );
              } else {
                sizeNames.push(sizeKey);
              }
            }

            // Validate price only if provided
            if ('price' in sizeVariant) {
              if (
                isNaN(parseFloat(sizeVariant.price)) ||
                parseFloat(sizeVariant.price) < 0
              ) {
                errors.push(
                  `Price must be a positive number for size #${j + 1} of color #${i + 1}.`
                );
              }
            }

            // Validate stock only if provided
            if ('stock' in sizeVariant) {
              if (
                isNaN(parseInt(sizeVariant.stock, 10)) ||
                parseInt(sizeVariant.stock, 10) < 0
              ) {
                errors.push(
                  `Stock must be a positive number for size #${j + 1} of color #${i + 1}.`
                );
              }
            }
          });
        }
      }
    });
  }
}

/////////////////


    if (errors.length > 0)
      return res.status(400).json({ message: 'Validation failed', errors });
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    console.log('Existing color variants in DB:', product.colorVariants.map(v => ({ id: String(v._id), colorName: v.colorName })));
    if (title !== undefined) product.title = title;
    if (description !== undefined) product.description = description;
    if (category_id !== undefined && category_id !== '') product.category_id = category_id;
    if (brand_id !== undefined && brand_id !== '') product.brand_id = brand_id;
    if (warranty !== undefined) product.warranty = warranty;

    const delImgs = Array.isArray(deletedImages) ? deletedImages : [];
    if (delImgs.length > 0) {
      product.colorVariants.forEach(variant => {
        variant.images = variant.images.filter(img => !delImgs.includes(img));
      });
    }
    if (Array.isArray(colorVariants)) {
      const existingMap = new Map();
      product.colorVariants.forEach(v => existingMap.set(String(v._id), v));

      const updatedVariants = [];

      for (const [index, variant] of colorVariants.entries()) {
        const colorId = variant.colorId;
        const existingVariant = colorId && existingMap.has(String(colorId)) ? existingMap.get(String(colorId)) : null;

        const newFiles = (req.files || []).filter(f =>
          f.fieldname === `colorVariants[${index}][images]`
        );
        const newImages = newFiles.map(f => `/${f.filename}`);

        if (existingVariant) {
          console.log('Found existing variant:', { id: String(existingVariant._id), colorName: existingVariant.colorName });
          console.log(`Processing variant index ${index} with colorId:`, variant.colorId, typeof variant.colorId);

          if (variant.colorName !== undefined) existingVariant.colorName = variant.colorName;
///////size variants//////////////////
      if (variant.variants !== undefined) {
           const newSizeVariants = Object.values(variant.variants);
           const existingSizesMap = new Map();
                 existingVariant.variants.forEach(sz => {
                 existingSizesMap.set(sz.size.trim().toLowerCase(), sz);
     });
           newSizeVariants.forEach(sz => {
         const sizeKey = sz.size.trim().toLowerCase();
         const parsedSize = {
          size: sz.size,
          price: parseFloat(sz.price),
          stock: parseInt(sz.stock, 10),
       };
       if (existingSizesMap.has(sizeKey)) {
        // Update existing size 
          const existing = existingSizesMap.get(sizeKey);
            existing.price = parsedSize.price;
            existing.stock = parsedSize.stock;
    } else {
      // Add new size
      existingSizesMap.set(sizeKey, parsedSize);
    }
  });
  existingVariant.variants = Array.from(existingSizesMap.values());
}
/////////////color variants/////////////
      if (variant.images !== undefined || newImages.length > 0) {
  function normalizeImagePath(path) {
    if (!path) return null;
    const filename = path.split('/').pop();
    return `/${filename}`; 
  }
  const clientImgs = (variant.images || []).map(img => {
    if (typeof img === "string") return normalizeImagePath(img);
    if (img.url) return normalizeImagePath(img.url);
    if (img.filename) return normalizeImagePath(img.filename);
    return null;
  }).filter(Boolean);
  let mergedImages = [...clientImgs];
  const maxImages = 3;
  for (const file of newImages) {
    const normalizedPath = file.filename ? normalizeImagePath(file.filename) :
                           (file.startsWith("/") ? normalizeImagePath(file) : `/${file.replace(/^\//, '')}`);
    const firstEmptyIndex = mergedImages.findIndex(img => !img || img.trim() === "");
    if (firstEmptyIndex !== -1) {
      mergedImages[firstEmptyIndex] = normalizedPath;
    } else if (mergedImages.length < maxImages) {
      mergedImages.push(normalizedPath);
    }
  }
  existingVariant.images = mergedImages.slice(0, maxImages);
}
updatedVariants.push(existingVariant);
existingMap.delete(String(colorId));
        } else {
          console.log('No matching existing variant found, will create new one.');
          const sizes = Object.values(variant.variants || {}).map(size => ({
            size: size.size,
            price: parseFloat(size.price),
            stock: parseInt(size.stock, 10),
          }));
          updatedVariants.push({
            colorName: variant.colorName,
            images: newImages,
            variants: sizes,
          });
        }
      }
      for (const leftoverVariant of existingMap.values()) {
        updatedVariants.push(leftoverVariant);
      }
      product.colorVariants = updatedVariants;
    }
    product.markModified('colorVariants');

    await product.save();
    return res.status(200).json({ message: 'Product updated successfully.' });
  } catch (err) {
    console.error('Error updating product:', err);
    return res.status(500).json({ message: 'Failed to update the product.', error: err.message });
  }
};




















