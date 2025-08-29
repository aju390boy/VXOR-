const Order = require('../../model/order.js');
const User = require('../../model/user.js');
const Product = require('../../model/product.js');
const Address = require('../../model/address.js'); // Assuming you have an Address model
const Cart = require('../../model/cart.js'); 

exports.placeOrder = async (req, res) => {
    try {
        const { addressId } = req.body;
        const userId = req.user._id;
        const TAX_RATE = 0.05;

        const cart = await Cart.findOne({ userId: userId }).populate({
            path: 'items.productId',
            model: 'Product'
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty.' });
        }

        const shippingAddress = await Address.findById(addressId);
        if (!shippingAddress) {
            return res.status(400).json({ message: 'Shipping address not found.' });
        }

        let subtotal = 0;
        let couponDiscount = 0; // Assuming this comes from req.body
        const productsToOrder = [];
        
        // Critical: Validate and RE-CALCULATE
        for (const item of cart.items) {
            const product = item.productId;

            if (!product) {
                return res.status(400).json({ message: 'One or more products in your cart are not available.' });
            }

            const colorVariant = product.colorVariants.find(
                (cv) => cv.colorName === item.colorName
            );

            if (!colorVariant) {
                return res.status(400).json({ message: `Color variant for ${product.title} not found.` });
            }

            const sizeVariant = colorVariant.variants.find(
                (sv) => sv.size === item.size
            );
            
            if (!sizeVariant) {
                return res.status(400).json({ message: `Size variant for ${product.title} not found.` });
            }

            if (sizeVariant.stock < item.quantity) {
                return res.status(400).json({ message: `Insufficient stock for ${product.title}. Available: ${sizeVariant.stock}` });
            }
            
            const price = Number(sizeVariant.price);
            subtotal += price * Number(item.quantity);

            productsToOrder.push({
                product_id: product._id,
                quantity: item.quantity,
                price: price,
                colorName: item.colorName, // SAVING THE COLOR
                size: item.size            // SAVING THE SIZE
            });
        }
        
        // Re-calculate tax and total on the server side for security
        const tax = subtotal * TAX_RATE;
        const total_amount = subtotal - couponDiscount + tax;

        const newOrder = new Order({
            user_id: userId,
            address_id: shippingAddress._id,
            products: productsToOrder,
            total_amount: total_amount.toFixed(2),
            // The status should be on each product, not the top level, per our schema.
            // new Order() will apply the default 'PROCESSING' status to each product.
            payment_status: 'PENDING', 
        });

        // I noticed your newOrder object had a top-level 'status', which your schema doesn't.
        // I've removed it to prevent errors. The default status will be applied to each product automatically.

        await newOrder.save();
        
        // You also need to decrement the stock here after a successful order.
        // This is a crucial step for inventory management.
        for (const item of cart.items) {
            await Product.updateOne(
                { 
                    _id: item.productId, 
                    'colorVariants.colorName': item.colorName,
                    'colorVariants.variants.size': item.size
                },
                { 
                    $inc: { 'colorVariants.$[c].variants.$[v].stock': -item.quantity }
                },
                {
                    arrayFilters: [
                        { 'c.colorName': item.colorName },
                        { 'v.size': item.size }
                    ]
                }
            );
        }
        
        cart.items = [];
        await cart.save();

        res.status(200).json({ 
            message: 'Order placed successfully!',
            orderId: newOrder.order_id,
            redirectUrl: '/user/success' // Or wherever you redirect
        });
        
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ 
            message: 'An internal server error occurred.',
            error: error.message
        });
    }
};
