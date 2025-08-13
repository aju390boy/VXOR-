const User = require('../../model/user.js');
const Cart = require('../../model/cart.js');
const Product = require('../../model/product.js'); // Assuming you have a Product model

// @desc    Get checkout page with order summary and address
// @route   GET /user/checkout
// @access  Private
exports.getCheckout = async (req, res) => {
    try {
        // Find the cart for the authenticated user and populate the product details
        const cart = await Cart.findOne({ user: req.user._id }).populate({
            path: 'items.product',
            model: 'Product'
        });

        // =======================================================
        // 1. First, check for an empty cart. If it's empty, handle it and return.
        // This prevents the code from running unnecessary logic and calculations.
        // =======================================================
        if (!cart || cart.items.length === 0) {
            return res.render('user/checkout', {
                title: 'Checkout',
                user: req.user,
                address: null, // Don't need an address for an empty cart
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

        // =======================================================
        // 2. Now that we know the cart is not empty, check for out-of-stock items.
        // We'll set a toast message and keep rendering the page.
        // =======================================================
        let toastMessage = null;
        const unavailableItems = cart.items.filter(item => item.product.stock < item.quantity);
        if (unavailableItems.length > 0) {
            toastMessage = {
                icon: 'error',
                text: 'One or more items in your cart are now out of stock. Please remove them to proceed.'
            };
        }

        // =======================================================
        // 3. Correctly find the user's default address from the Address collection.
        // This is the main fix for the address logic.
        // =======================================================
        const defaultAddress = await Address.findOne({ user_id: req.user._id, isDefault: true });

        // Check if a default address exists.
        if (!defaultAddress) {
            toastMessage = {
                icon: 'error',
                text: 'Please add a default address before proceeding to checkout.'
            };
        }

        // =======================================================
        // 4. Calculate the totals. This section is now outside of any "empty cart" check,
        // so it will always run as long as the cart is not empty.
        // =======================================================
        const subtotal = cart.items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
        const taxRate = 0.1; // 10% tax rate
        const tax = subtotal * taxRate;
        const couponDiscount = 0; // Placeholder for coupon logic
        const total = subtotal + tax - couponDiscount;

        // =======================================================
        // 5. Render the checkout page with the calculated data.
        // =======================================================
        res.render('user/checkout', {
            title: 'Checkout',
            user: req.user,
            address: defaultAddress, // Pass the found default address
            cartItems: cart.items,
            subtotal: subtotal,
            tax: tax,
            couponDiscount: couponDiscount,
            total: total,
            toastMessage: toastMessage // Pass any toast message we may have set
        });

    } catch (error) {
        console.error('Error in getCheckout:', error);
        res.status(500).render('error', { title: 'Error', message: 'Something went wrong.' });
    }
};

