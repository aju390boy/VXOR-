const Product=require('../../model/product.js');
const Cart = require('../../model/cart.js')
const {findBestOffer} = require('../../utils/offerHelper.js');

exports.addToCart = async (req, res) => {
  console.log('cart hitted.....................')
    const userId = req.user._id; 
    const { productId, colorName, size, quantity } = req.body;
    try {
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        if (!product.isListed) {
            return res.status(404).json({ message: 'Product is not Listed.' });
        }
         if (product.isDeleted) {
            return res.status(404).json({ message: 'Product is tempererly deleted.' });
        }
        const colorVariant = product.colorVariants.find(c => c.colorName === colorName);
        if (!colorVariant) {
            return res.status(400).json({ message: 'Invalid color selected for this product.' });
        }
        const sizeVariant = colorVariant.variants.find(s => s.size === size);
        if (!sizeVariant) {
            return res.status(400).json({ message: 'Invalid size selected for this product.' });
        }
        if (sizeVariant.stock < quantity) {
            return res.status(400).json({ message: `Insufficient stock. Only ${sizeVariant.stock} available.` });
        }
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }
        const existingItemIndex = cart.items.findIndex(item =>
            item.productId.toString() === productId &&
            item.colorName === colorName &&
            item.size === size
        );
        if (existingItemIndex > -1) {
            cart.items[existingItemIndex].quantity += quantity;
        } else {
            cart.items.push({ productId, colorName, size, quantity });
        }
        await cart.save();
        res.status(200).json({ message: 'Product added to cart successfully.', cart });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};
exports.getCart = async (req, res) => {
    const userId = req.user._id;
    const TAX_RATE = 0.05; 
    const message = req.session.message;
    delete req.session.message; 
    try {
        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'title description colorVariants isListed category_id brand_id isDeleted',
                populate: [ 
                    { path: 'category_id', select: 'name isListed' }, 
                    { path: 'brand_id', select: 'name isListed' }
                ]
            })
            .lean();
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render('user/cart', {
                cartItems: [],
                subtotal: 0,
                totalDiscount: 0,
                tax: 0,
                total: 0,
                message: message 
            });
        }
        let originalSubtotal = 0;
        let offerSubtotal = 0;
        const cartItemsForEJS = await Promise.all(cart.items.map(async (item) => {
            const product = item.productId;
            if (!product) return null;
            const colorVariant = product.colorVariants.find(c => c.colorName === item.colorName);
            const sizeVariant = colorVariant ? colorVariant.variants.find(s => s.size === item.size) : null;
            const originalPrice = sizeVariant ? sizeVariant.price : 0;
            const stock = sizeVariant ? sizeVariant.stock : 0;
            const isAvailable = !product.isDeleted && product.isListed && product.category_id?.isListed && product.brand_id?.isListed && stock > 0;
            const bestOffer = isAvailable ? await findBestOffer(product._id, product.category_id?._id, product.brand_id?._id) : null;
            let finalPrice = originalPrice;
            if (bestOffer) {
                finalPrice = originalPrice * (1 - bestOffer.discountPercentage / 100);
            }
            if (isAvailable) {
                originalSubtotal += originalPrice * item.quantity;
                offerSubtotal += finalPrice * item.quantity;
            }
            const imagePath = colorVariant?.images[0].startsWith('http') ? colorVariant.images[0] :  `/uploads/products/${colorVariant.images[0]}`;
            return {
                id: item._id.toString(),
                productId: product._id.toString(),
                name: product.title,
                image: imagePath,
                size: item.size,
                colorName: item.colorName,
                originalPrice: originalPrice, 
                finalPrice: finalPrice,       
                quantity: item.quantity,
                stock: stock,
                isAvailable: isAvailable,
                bestOffer: bestOffer          
            };
        }));
        const validCartItems = cartItemsForEJS.filter(item => item !== null);
        const totalDiscount = originalSubtotal - offerSubtotal;
        const tax = offerSubtotal * TAX_RATE;
        const total = offerSubtotal + tax;

        res.render('user/cart', {
            cartItems: validCartItems,
            subtotal: originalSubtotal.toFixed(2),
            totalDiscount: totalDiscount.toFixed(2), 
            finalTotal: offerSubtotal.toFixed(2),   
            tax: tax.toFixed(2),
            total: total.toFixed(2),               
            message: message 
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).render('user/error', { message: 'Server error.', error: error.message });
    }
};
exports.updateCartQunty = async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }
  const userId = req.user._id;
  const { itemId } = req.params;
  const { quantity: newQuantity } = req.body;
  const TAX_RATE = 0.05;

  try {
    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      select: 'title description colorVariants isListed category_id brand_id isDeleted',
      populate: [
        { path: 'category_id', select: 'name isListed' },
        { path: 'brand_id', select: 'name isListed' }
      ]
    });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found for this user.' });
    }
    const itemToUpdate = cart.items.find(item => item._id.toString() === itemId);
    if (!itemToUpdate) {
      return res.status(404).json({ message: 'Item not found in cart.' });
    }
    if (newQuantity < 1) {
      return res.status(400).json({ message: 'Quantity cannot be less than 1.' });
    }
    const product = itemToUpdate.productId;
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const colorVariant = product.colorVariants.find(cv => cv.colorName === itemToUpdate.colorName);
    const sizeVariant = colorVariant?.variants.find(sv => sv.size === itemToUpdate.size);
    if (!sizeVariant) {
      return res.status(404).json({ message: 'Product variant not found.' });
    }

    if (newQuantity > sizeVariant.stock) {
      return res.status(400).json({ message: `Selected quantity exceeds available stock (${sizeVariant.stock}).` });
    }

    itemToUpdate.quantity = newQuantity;
    await cart.save();

    let originalSubtotal = 0;
    let offerSubtotal = 0;

    for (const item of cart.items) {
      if (!item.productId) continue;
      const prod = item.productId;
      const cVariant = prod.colorVariants.find(cv => cv.colorName === item.colorName);
      const sVariant = cVariant?.variants.find(sv => sv.size === item.size);

      if (!sVariant) continue;
      const originalPrice = sVariant.price;
      const stock = sVariant.stock;
      const isAvailable = !prod.isDeleted && prod.isListed && prod.category_id?.isListed && prod.brand_id?.isListed && stock > 0;
      let finalPrice = originalPrice;
      const bestOffer = isAvailable ? await findBestOffer(product._id, product.category_id?._id, product.brand_id?._id) : null;
      
      if (bestOffer) {
        finalPrice = originalPrice * (1 - bestOffer.discountPercentage / 100);
      }
      if (isAvailable) {
        originalSubtotal += originalPrice * item.quantity;
        offerSubtotal += finalPrice * item.quantity;
      }
    }

    const totalDiscount = originalSubtotal - offerSubtotal;
    const tax = offerSubtotal * TAX_RATE;
    const total = offerSubtotal + tax;

    const updatedItem = {
      _id: itemToUpdate._id,
      quantity: itemToUpdate.quantity,
      price: sizeVariant.price,

    };
    const itemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    res.status(200).json({
      success: true,
      message: 'Cart item quantity updated successfully.',
      updatedItem,
      cartSummary: {
        subtotal: originalSubtotal.toFixed(2),
        totalDiscount: totalDiscount.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        itemsCount,
      },
    });
  } catch (error) {
    console.error('Error updating cart item quantity:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};


exports.removeCartItm = async (req, res) => {
    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    } 
    const userId = req.user._id;
    const { itemId } = req.params;
    try {
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found for this user.' });
        }
        const initialItemCount = cart.items.length;
        cart.items = cart.items.filter(item => item._id.toString() !== itemId);
        if (cart.items.length === initialItemCount) {
            return res.status(404).json({ message: 'Item not found in cart.' });
        }
        await cart.save();
        res.status(200).json({ message: 'Item removed from cart successfully.', cart });

    } catch (error) {
        console.error('Error removing cart item:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};


exports.getCartCount = async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.user._id });
        if (!cart) {
            return res.json({ success: true, count: 0 });
        }
        const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        res.json({ success: true, count: count });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};