const Order = require('../../model/order.js');
const User = require('../../model/user.js');
const Product = require('../../model/product.js');
const Address = require('../../model/address.js'); // Assuming you have an Address model
const Cart = require('../../model/cart.js'); 

exports.placeOrder = async (req, res) => {
    try {
        const { addressId } = req.body;
        const userId = req.user._id;

        // Find the user's cart using the correct field name 'userId'
        const cart = await Cart.findOne({ userId: userId }).populate({
            path: 'items.productId',
            model: 'Product'
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty.' });
        }

        // Find the default address to be absolutely sure it exists
        const shippingAddress = await Address.findById(addressId);
        if (!shippingAddress) {
            return res.status(400).json({ message: 'Shipping address not found.' });
        }

        let subtotal = 0;
        let couponDiscount = 0;
        let tax = 0;

        for (const item of cart.items) {
            const product = item.productId;
            if (!product) {
                console.error(`Product not found for cart item: ${item._id}`);
                continue; 
            }

            const colorVariant = product.colorVariants.find(
                (cv) => cv.colorName === item.colorName
            );

            if (!colorVariant) {
                console.error(`Color variant not found for product ${product._id} with color ${item.colorName}`);
                continue; 
            }

            const sizeVariant = colorVariant.variants.find(
                (sv) => sv.size === item.size
            );

            if (!sizeVariant) {
                console.error(`Size variant not found for product ${product._id} with size ${item.size}`);
                continue; 
            }

            subtotal += Number(sizeVariant.price) * Number(item.quantity);
        }

        const total_amount = subtotal - couponDiscount + tax;

        if (isNaN(total_amount)) {
            console.error(`Calculated total_amount is NaN. Subtotal: ${subtotal}, Tax: ${tax}, Discount: ${couponDiscount}`);
            return res.status(500).json({ message: 'Failed to calculate order total. Please try again.' });
        }

        // Create the order document with the correct field names and enum values
        const newOrder = new Order({
            user_id: userId, // Correct field name to match the schema
            address_id: shippingAddress._id, // Correct field name to match the schema
            products: cart.items.map(item => ({
                product_id: item.productId,
                quantity: item.quantity,
                // You might also want to add the price at the time of purchase here
                price: item.productId.colorVariants.find(c => c.colorName === item.colorName)?.variants.find(s => s.size === item.size)?.price
            })),
            total_amount: total_amount,
            status: 'PROCESSING', // Use the lowercase enum value
            payment_status: 'PENDING', // Use the lowercase enum value
            // coupon_id: ...
        });

        await newOrder.save();
        
        // Clear the user's cart after a successful order
        cart.items = [];
        await cart.save();

        res.status(200).json({ 
            message: 'Order placed successfully!',
            orderId: newOrder._id,
            redirectUrl: '/user/success' // Or whatever your success page URL is
        });

        
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ 
            message: 'An internal server error occurred.',
            error: error.message
        });
    }
};
