const Product=require('../../model/product.js');
const Cart = require('../../model/cart.js')

exports.addToCart = async (req, res) => {
    // Assumes 'protect' middleware adds the user object to the request
    const userId = req.user._id; 
    const { productId, colorName, size, quantity } = req.body;

    try {
        // 1. Validate the product, color, and size variants against the Product schema
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        
        const colorVariant = product.colorVariants.find(c => c.colorName === colorName);
        if (!colorVariant) {
            return res.status(400).json({ message: 'Invalid color selected for this product.' });
        }
        
        const sizeVariant = colorVariant.variants.find(s => s.size === size);
        if (!sizeVariant) {
            return res.status(400).json({ message: 'Invalid size selected for this product.' });
        }
        
        // 2. Check for sufficient stock before adding to cart
        if (sizeVariant.stock < quantity) {
            return res.status(400).json({ message: `Insufficient stock. Only ${sizeVariant.stock} available.` });
        }
        
        // 3. Find the user's cart or create a new one if it doesn't exist
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        // 4. Check if the item (by product, color, and size) is already in the cart
        const existingItemIndex = cart.items.findIndex(item =>
            item.productId.toString() === productId &&
            item.colorName === colorName &&
            item.size === size
        );

        if (existingItemIndex > -1) {
            // Item exists, update its quantity
            cart.items[existingItemIndex].quantity += quantity;
        } else {
            // Item is new, add it to the cart
            cart.items.push({ productId, colorName, size, quantity });
        }

        // 5. Save the updated cart to the database
        await cart.save();
        res.status(200).json({ message: 'Product added to cart successfully.', cart });

    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

/**
 * @desc    Get the user's cart and render the cart EJS page
 * @route   GET /api/cart
 * @access  Private
 */
exports.getCart = async (req, res) => {
    const userId = req.user._id;
    const TAX_RATE = 0.05; 
    
    // Check for an existing session message to display (from a previous redirect)
    // We store it in a temporary variable and immediately clear the session.
    const message = req.session.message;
    req.session.message = null;

    try {
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            select: 'title description colorVariants isListed category_id brand_id isDeleted',
            populate: [ 
                { path: 'category_id', select: 'isListed' },
                { path: 'brand_id', select: 'isListed' }
            ]
        });

        if (!cart) {
            return res.render('user/cart', {
                cartItems: [],
                subtotal: 0,
                tax: 0,
                total: 0,
                message: message 
            });
        }
        
        let foundInvalidItem = false;
        let validCartItems = [];

        // Check each item and remove invalid ones directly from the cart
        for (const item of cart.items) {
            const product = item.productId;
            if (!product || product.isDeleted || !product.isListed || !product.category_id.isListed || !product.brand_id.isListed) {
                // Mark the item for removal from the database
                cart.items.pull(item._id); 
                foundInvalidItem = true;
            } else {
                // If valid, add to the temporary array
                validCartItems.push(item);
            }
        }

        // Determine the message to show.
        // If we found an invalid item on this request, we create a NEW message.
        // Otherwise, we use any existing message from a previous request.
        let finalMessage = message;
        if (foundInvalidItem) {
            // This is the message for the *current* page load, not a future one.
            finalMessage = {
                icon: 'error',
                title: 'Item Removed',
                text: 'One or more items in your cart were removed because they are no longer available.'
            };
            // Now that we've determined the message, save the updated cart
            // to permanently remove the invalid items.
            await cart.save();
        }

        let subtotal = 0;
        const cartItemsForEJS = validCartItems.map(item => {
            const product = item.productId;
            const colorVariant = product.colorVariants.find(c => c.colorName === item.colorName);
            const sizeVariant = colorVariant ? colorVariant.variants.find(s => s.size === item.size) : null;
            
            const price = sizeVariant ? sizeVariant.price : 0;
            const itemTotal = price * item.quantity;
            subtotal += itemTotal;

            const imagePath = colorVariant && colorVariant.images && colorVariant.images.length > 0 
                ? `/uploads/products/${colorVariant.images[0]}` 
                : '/images/placeholder.png';

            return {
                id: item._id, 
                name: product.title,
                image: imagePath,
                size: item.size,
                colorName: item.colorName,
                price: price,
                quantity: item.quantity,
                stock: sizeVariant ? sizeVariant.stock : 0,
            };
        });

        const tax = subtotal * TAX_RATE;
        const total = subtotal + tax;

        res.render('user/cart', {
            cartItems: cartItemsForEJS,
            subtotal: subtotal.toFixed(2),
            tax: tax.toFixed(2),
            total: total.toFixed(2),
            message: finalMessage // Pass the new or existing message
        });

    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).render('user/error', { message: 'Server error.', error: error.message });
    }
};

/**
 * @desc    Update the quantity of a specific item in the cart
 * @route   PATCH /api/cart/update
 * @access  Private
 */
exports.updateCartItemQuantity = async (req, res) => {
    const userId = req.user._id;
    const { itemId, quantity } = req.body;

    try {
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found.' });
        }

        const itemToUpdate = cart.items.find(item => item._id.toString() === itemId);
        if (!itemToUpdate) {
            return res.status(404).json({ message: 'Item not found in cart.' });
        }
        
        if (quantity < 1) {
            return res.status(400).json({ message: 'Quantity cannot be less than 1.' });
        }

        itemToUpdate.quantity = quantity;
        await cart.save();
        res.status(200).json({ message: 'Cart item quantity updated successfully.', cart });
        
    } catch (error) {
        console.error('Error updating cart item quantity:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

/**
 * @desc    Remove a specific item from the cart
 * @route   DELETE /api/cart/:itemId
 * @access  Private
 */
exports.removeCartItem = async (req, res) => {
    const userId = req.user._id;
    const { itemId } = req.params;

    try {
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found.' });
        }

        // Filter out the item to be removed
        cart.items = cart.items.filter(item => item._id.toString() !== itemId);

        await cart.save();
        res.status(200).json({ message: 'Item removed from cart successfully.', cart });

    } catch (error) {
        console.error('Error removing cart item:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};
