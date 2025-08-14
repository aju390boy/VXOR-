const User = require('../../model/user.js');
const Cart = require('../../model/cart.js');
const Product = require('../../model/product.js'); // Assuming you have a Product model
const Address = require('../../model/address.js')

// @desc    Get checkout page with order summary and address
// @route   GET /user/checkout
// @access  Private
exports.getCheckout = async (req, res) => {
    try {
        // Corrected: Use 'userId' to query the cart
        // Corrected: Use 'items.productId' to populate the product details
        const cart = await Cart.findOne({ userId: req.user._id }).populate({
            path: 'items.productId',
            model: 'Product'
        });

        

        if (!cart || cart.items.length === 0) {
            return res.render('user/checkout', {
                title: 'Checkout',
                user: req.user,
                address: null,
                cartItems: [],
                subtotal: 0,
                tax: 0,
                couponDiscount: 0,
                total: 0,
                toastMessage: {
                    icon: 'error',
                    text: 'Your cart is empty. Please add items before checking out.'
                }
            });
        }

        let toastMessage = null;

        // Check for out-of-stock items (this logic seems fine)
        const unavailableItems = cart.items.filter(item => {
            const variant = item.productId.colorVariants
                .find(c => c.colorName === item.colorName)?.variants
                .find(s => s.size === item.size);
            return !variant || variant.stock < item.quantity;
        });
        
        if (unavailableItems.length > 0) {
            toastMessage = {
                icon: 'error',
                text: 'One or more items in your cart are now out of stock. Please remove them to proceed.'
            };
        }

        // Correctly find the user's default address
        const defaultAddress = await Address.findOne({ user_id: req.user._id, isDefault: true });

        if (!defaultAddress) {
            toastMessage = {
                icon: 'error',
                text: 'Please add a default address before proceeding to checkout.'
            };
        }

        // Corrected: Recalculate subtotal by finding the price from the product's nested variants
        const subtotal = cart.items.reduce((acc, item) => {
            const variantPrice = item.productId.colorVariants
                .find(c => c.colorName === item.colorName)?.variants
                .find(s => s.size === item.size)?.price;

            if (variantPrice) {
                return acc + (variantPrice * item.quantity);
            }
            return acc; // If price isn't found, don't add to subtotal
        }, 0);

        const taxRate = 0.1;
        const tax = subtotal * taxRate;
        const couponDiscount = 0;
        const total = subtotal + tax - couponDiscount;
        console.log(cart.items)
        res.render('user/checkout', {
            title: 'Checkout',
            user: req.user,
            address: defaultAddress,
            cartItems: cart.items,
            subtotal: subtotal,
            tax: tax,
            couponDiscount: couponDiscount,
            total: total,
            toastMessage: toastMessage
        });

    } catch (error) {
        console.error('Error in getCheckout:', error);
        res.status(500).render('error', { title: 'Error', message: 'Something went wrong.' });
    }
};
