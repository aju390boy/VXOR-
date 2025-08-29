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
    
    const message = req.session.message;
    req.session.message = null;

    try {
        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'title description colorVariants isListed category_id brand_id isDeleted',
                populate: [ 
                    { path: 'category_id', select: 'isListed' },
                    { path: 'brand_id', select: 'isListed' }
                ]
            })
            .lean();

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render('user/cart', {
                cartItems: [],
                subtotal: 0,
                tax: 0,
                total: 0,
                message: message 
            });
        }
        
        let subtotal = 0;
        const cartItemsForEJS = cart.items.map(item => {
            const product = item.productId;
            
            // Check if product exists and is valid
            if (!product) {
                console.error('Product not found for item in cart:', item._id);
                return null;
            }

            const colorVariant = product.colorVariants.find(c => c.colorName === item.colorName);
            const sizeVariant = colorVariant ? colorVariant.variants.find(s => s.size === item.size) : null;
            
            const price = sizeVariant ? sizeVariant.price : 0;
            const stock = sizeVariant ? sizeVariant.stock : 0;
            const isAvailable = !product.isDeleted && 
                                product.isListed && 
                                product.category_id && 
                                product.category_id.isListed && 
                                product.brand_id && 
                                product.brand_id.isListed &&
                                stock > 0;

            if (isAvailable) {
                const itemTotal = price * item.quantity;
                subtotal += itemTotal;
            }

            const imagePath = colorVariant && colorVariant.images && colorVariant.images.length > 0 
                ? `/uploads/products/${colorVariant.images[0]}` 
                : '/images/placeholder.png';

            return {
                id: item._id.toString(),
                name: product.title,
                image: imagePath,
                size: item.size,
                colorName: item.colorName,
                price: price,
                quantity: item.quantity,
                stock: stock,
                isAvailable: isAvailable
            };
        }).filter(item => item !== null);

        const tax = subtotal * TAX_RATE;
        const total = subtotal + tax;

        res.render('user/cart', {
            cartItems: cartItemsForEJS,
            subtotal: subtotal.toFixed(2),
            tax: tax.toFixed(2),
            total: total.toFixed(2),
            message: message 
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
exports.updateCartQunty = async (req, res) => {
    // console.log("User from authentication middleware:", req.user); 
    // Ensure the user is authenticated before proceeding
    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }

    const userId = req.user._id;
    const { itemId } = req.params;
    const { quantity: newQuantity } = req.body;

    try {
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found for this user.' });
        }

        const itemToUpdate = cart.items.find(item => item._id.toString() === itemId);
        if (!itemToUpdate) {
            return res.status(404).json({ message: 'Item not found in cart.' });
        }
        
        // Basic quantity validation
        if (newQuantity < 1) {
            return res.status(400).json({ message: 'Quantity cannot be less than 1.' });
        }

        // Fetch the product with all its variant information
        const product = await Product.findById(itemToUpdate.productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // CORRECTED LOGIC: Find the variant using colorName and size, which are stored in the cart item
        const colorVariant = product.colorVariants.find(cv => cv.colorName === itemToUpdate.colorName);
        const sizeVariant = colorVariant?.variants.find(sv => sv.size === itemToUpdate.size);
        
        // Check if the variant was found and if the new quantity exceeds its stock
        if (!sizeVariant) {
            return res.status(404).json({ message: 'Product variant not found.' });
        }
        if (newQuantity > sizeVariant.stock) {
            return res.status(400).json({ message: `The selected quantity exceeds available stock (${sizeVariant.stock}).` });
        }

        // Update the item quantity and save
        itemToUpdate.quantity = newQuantity;
        await cart.save();
        
        res.status(200).json({ message: 'Cart item quantity updated successfully.', cart });
        
    } catch (error) {
        console.error('Error updating cart item quantity:', error);
        res.status(500).json({ message: 'Server error.', error: error.message });
    }
};

/**
 * @desc    Remove a specific item from the cart
 * @route   DELETE /api/cart/remove-item/:itemId
 * @access  Private
 */
exports.removeCartItm = async (req, res) => {
    console.log("User from authentication middleware:", req.user);
    // Ensure the user is authenticated before proceeding
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

        // Filter out the item to be removed
        const initialItemCount = cart.items.length;
        cart.items = cart.items.filter(item => item._id.toString() !== itemId);

        // Check if an item was actually removed
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
