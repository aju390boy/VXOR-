const Order = require("../../model/order.js");
const User = require("../../model/user.js");
const Product = require("../../model/product.js");
const Address = require("../../model/address.js");
const Cart = require("../../model/cart.js");
const Wallet = require('../../model/wallet.js');
const Coupon = require('../../model/coupon.js');
const {findBestOffer} = require('../../utils/offerHelper.js');

exports.placeOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod } = req.body;
        const userId = req.user._id;
        const TAX_RATE = 0.05;
        // --- 1. VALIDATE ADDRESS ---
        const shippingAddress = await Address.findById(addressId);
        if (!shippingAddress) {
            return res.status(400).json({ message: "Shipping address not found." });
        }

        const cart = await Cart.findOne({ userId: userId }).populate({
            path: "items.productId",
            populate: ['category_id', 'brand_id']
        });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: "Your cart is empty." });
        }

        let originalSubtotal = 0;
        let totalAfterOffers = 0;
        const productsToOrder = [];

        // --- 2. VALIDATE EACH CART ITEM & CALCULATE TOTALS ---
        for (const item of cart.items) {
            const product = item.productId;

            // Granular validation from your original code
            if (!product) {
                return res.status(400).json({ message: "One or more products in your cart are not available." });
            }
            const colorVariant = product.colorVariants.find((cv) => cv.colorName === item.colorName);
            if (!colorVariant) {
                return res.status(400).json({ message: `Color variant for ${product.title} not found.` });
            }
            const sizeVariant = colorVariant.variants.find((sv) => sv.size === item.size);
            if (!sizeVariant) {
                return res.status(400).json({ message: `Size variant for ${product.title} not found.` });
            }
            if (sizeVariant.stock < item.quantity) {
                return res.status(400).json({ message: `Insufficient stock for ${product.title}. Available: ${sizeVariant.stock}` });
            }

            // Secure price calculation
            const originalPrice = sizeVariant.price;
            const bestOffer = await findBestOffer(product._id, product.category_id?._id, product.brand_id?._id);
            let finalPrice = originalPrice;
            if (bestOffer) {
                finalPrice = originalPrice * (1 - bestOffer.discountPercentage / 100);
            }

            originalSubtotal += originalPrice * item.quantity;
            totalAfterOffers += finalPrice * item.quantity;

            productsToOrder.push({
                product_id: product._id,
                quantity: item.quantity,
                originalPrice: originalPrice,
                price: finalPrice,
                colorName: item.colorName,
                size: item.size,
            });
        }

        // --- 3. APPLY COUPON & WALLET LOGIC ---
        let couponDiscount = 0;
        if (req.session.coupon) {
            couponDiscount = req.session.coupon.discount;
        }

        let finalAmount = totalAfterOffers - couponDiscount;
        const tax = finalAmount > 0 ? finalAmount * TAX_RATE : 0;
        finalAmount += tax;
        
        let paymentStatus = 'PENDING';

        if (paymentMethod === 'wallet') {
            const wallet = await Wallet.findOne({ user_id: userId });
            if (!wallet || wallet.balance < finalAmount) {
                return res.status(400).json({ message: 'Insufficient wallet balance.' });
            }
            wallet.balance -= finalAmount;
            wallet.transactions.push({
                amount: finalAmount,
                type: 'debit',
                description: 'Paid for order'
            });
            await wallet.save();
            paymentStatus = 'COMPLETED';
        }
        
        // ... (Add logic for 'razorpay' here in the future) ...

        // --- 4. CREATE ORDER & UPDATE DATABASE ---
        const newOrder = new Order({
            user_id: userId,
            address_id: shippingAddress._id,
            products: productsToOrder,
            total_amount: finalAmount.toFixed(2),
            payment_status: paymentStatus,
            payment_method: paymentMethod,
            offerDiscount: originalSubtotal - totalAfterOffers,
            couponDiscount: couponDiscount
        });
        await newOrder.save();
        
        if (paymentMethod === 'wallet') {
            const wallet = await Wallet.findOne({ user_id: userId });
            const latestTransaction = wallet.transactions[wallet.transactions.length - 1];
            latestTransaction.orderId = newOrder.order_id;
            await wallet.save();
        }

        if (req.session.coupon) {
            await Coupon.updateOne({ code: req.session.coupon.code }, { $push: { usedBy: userId } });
        }

        for (const item of productsToOrder) {
            await Product.updateOne(
                { _id: item.product_id, "colorVariants.colorName": item.colorName, "colorVariants.variants.size": item.size },
                { $inc: { "colorVariants.$[c].variants.$[v].stock": -item.quantity } },
                { arrayFilters: [{ "c.colorName": item.colorName }, { "v.size": item.size }] }
            );
        }

        await Cart.deleteOne({ userId: userId });
        delete req.session.coupon;

        res.status(200).json({
            success: true,
            message: "Order placed successfully!",
            redirectUrl: "/user/success"
        });
        
    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ message: "An internal server error occurred." });
    }
};



exports.setDefaultAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const userId = req.user._id;
        await Address.updateMany(
            { user_id: userId }, 
            { $set: { isDefault: false } }
        );
        await Address.findByIdAndUpdate(addressId, { 
            $set: { isDefault: true } 
        });
        res.status(200).json({ 
            success: true, 
            message: 'Default address updated successfully.' 
        });

    } catch (error) {
        console.error('Error setting default address:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred on the server. Please try again.' 
        });
    }
};
