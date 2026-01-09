const User = require('../../model/user.js');
const Cart = require('../../model/cart.js');
const Product = require('../../model/product.js');
const Address = require('../../model/address.js');
const Wallet = require('../../model/wallet.js');
const Coupon = require('../../model/coupon.js'); 
const {findBestOffer} = require('../../utils/offerHelper.js');


exports.getCheckout = async (req, res) => {
    const TAX_RATE = 0.05;
    const userId = req.user._id;
    try {
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            model: 'Product',
            populate: [
                { path: 'category_id', select: 'name' },
                { path: 'brand_id', select: 'name' }
            ]
        }).lean();
        const availableCoupons = await Coupon.find({
            isActive: true,
            expiryDate: { $gte: new Date() } 
        }).lean();

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart');
        }
        const allAddresses = await Address.find({ user_id: userId }).lean();
        const defaultAddress = allAddresses.find(addr => addr.isDefault);
        const wallet = await Wallet.findOne({ user_id: userId }).lean();
        const walletBalance = wallet ? wallet.balance : 0;
        let originalSubtotal = 0;
        let offerSubtotal = 0; 
        const validCartItems = []; 
        for (const item of cart.items) {
            // Validate Quantity Limit first
            if (item.quantity > 5) {
                req.session.message = { type: 'error', text: 'One or more products exceed the max quantity limit'};
                return res.redirect('/cart');
            }
            // Fetch Product Data
            const productItem = await Product.findById(item.productId)
                .populate('category_id')
                .populate('brand_id')
                .lean();
            // Validate Product Status
            if (!productItem) {
                req.session.message = { type: 'error', text: 'Product not found.' };
                return res.redirect('/cart');
            }
            if (!productItem.isListed) {
                req.session.message = { type: 'error', text: 'One or more products is Not Listed.' };
                return res.redirect('/cart');
            }
            if (productItem.isDeleted) {
                req.session.message = { type: 'error', text: 'One or more products is Temporarily Deleted.' };
                return res.redirect('/cart');
            }
            if (!productItem.category_id || !productItem.category_id.isListed) {
                req.session.message = { type: 'error', text: 'Product Category does not exist or is Not Listed.' };
                return res.redirect('/cart');
            }
            if (!productItem.brand_id || !productItem.brand_id.isListed) {
                req.session.message = { type: 'error', text: 'Product Brand does not exist or is Not Listed.' };
                return res.redirect('/cart');
            }
            // Validate Stock
            const sizeVariant = productItem.colorVariants
                .find(c => c.colorName === item.colorName)?.variants
                .find(s => s.size === item.size);
            if (!sizeVariant || sizeVariant.stock < item.quantity) {
                validCartItems.push({ 
                    ...item, 
                    productId: productItem, 
                    isAvailable: false, 
                    finalPrice: 0, 
                    originalPrice: 0 
                });
                continue;
            }
            const originalPrice = sizeVariant.price;
            const bestOffer = await findBestOffer(productItem._id, productItem.category_id?._id, productItem.brand_id?._id);
            let finalPrice = originalPrice;
            if (bestOffer) {
                finalPrice = originalPrice * (1 - bestOffer.discountPercentage / 100);
            }
            // Update Totals
            originalSubtotal += originalPrice * item.quantity;
            offerSubtotal += finalPrice * item.quantity;
            validCartItems.push({ 
                ...item, 
                productId: productItem, 
                finalPrice, 
                originalPrice, 
                bestOffer, 
                isAvailable: true 
            });
        }
        if (validCartItems.some(item => !item.isAvailable)) {
            req.session.message = { type: 'error', text: 'Some items in your cart are out of stock. Please review your cart.' };
            return res.redirect('/cart');
        }
        const totalDiscount = originalSubtotal - offerSubtotal;
        const tax = offerSubtotal * TAX_RATE;
        const total = offerSubtotal + tax;
        const isCodAvailable = total <= 20000; 
        res.render('user/checkout', {
            title: 'Checkout',
            user: req.user,
            allAddresses,
            address: defaultAddress,
            cartItems: validCartItems,
            walletBalance: walletBalance.toFixed(2),
            isCodAvailable,
            availableCoupons,
            totals: {
                subtotal: originalSubtotal.toFixed(2),
                discount: totalDiscount.toFixed(2),
                finalTotal: offerSubtotal.toFixed(2),
                tax: tax.toFixed(2),
                grandTotal: total.toFixed(2)
            }
        });
    } catch (error) {
        console.error('Error in getCheckout:', error);
        res.status(500).send('Server Error');
    }
};

exports.applyCoupon = async (req, res) => {
    try {
        delete req.session.coupon;
        const userId = req.user._id;
        const { couponCode } = req.body;
        const uppercaseCouponCode = couponCode.toUpperCase();
        const cart = await Cart.findOne({ userId }).populate({ path: 'items.productId', populate: ['category_id', 'brand_id'] });

        let totalAfterOffers = 0;
        await Promise.all(cart.items.map(async (item) => {
            const product = item.productId;
            const sizeVariant = product.colorVariants.find(c => c.colorName === item.colorName)?.variants.find(s => s.size === item.size);
            const originalPrice = sizeVariant ? sizeVariant.price : 0;
            const bestOffer = await findBestOffer(product._id, product.category_id?._id, product.brand_id?._id);
            let finalPrice = originalPrice;
            if (bestOffer) {
                finalPrice = originalPrice * (1 - bestOffer.discountPercentage / 100);
            }
            totalAfterOffers += finalPrice * item.quantity;
        }));

        const taxForRevert = totalAfterOffers * 0.05;
        const revertTotal = totalAfterOffers + taxForRevert;
        
        const coupon = await Coupon.findOne({ code: uppercaseCouponCode });
        if (!coupon) {
            return res.json({ success: false, message: 'Invalid coupon code.', newGrandTotal: revertTotal.toFixed(2) });
        }
        if (new Date(coupon.expiryDate) < new Date()) {
            return res.json({ success: false, message: 'This coupon has expired.', newGrandTotal: revertTotal.toFixed(2) });
        }
        if (!coupon.isActive) {
             return res.json({ success: false, message: 'This coupon is not active.', newGrandTotal: revertTotal.toFixed(2) });
        }
        if (coupon.usedBy.includes(userId)) {
             return res.json({ success: false, message: 'You have already used this coupon.', newGrandTotal: revertTotal.toFixed(2) });
        }
        if (coupon.usedBy.length >= coupon.usageLimit) {
             return res.json({ success: false, message: 'This coupon has reached its usage limit.', newGrandTotal: revertTotal.toFixed(2) });
        }
        if (totalAfterOffers < coupon.minPurchaseAmount) {
            return res.json({ success: false, message: `A minimum purchase of ₹${coupon.minPurchaseAmount} is required.`, newGrandTotal: revertTotal.toFixed(2) });
        }
        
        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = (totalAfterOffers * coupon.discountValue) / 100;
            if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
                discountAmount = coupon.maxDiscountAmount;
            }
        } else {
            discountAmount = coupon.discountValue;
        }
        discountAmount = Math.min(totalAfterOffers, discountAmount);
        
        const newGrandTotalWithCoupon = totalAfterOffers - discountAmount;
        const tax = newGrandTotalWithCoupon * 0.05;
        const finalAmount = newGrandTotalWithCoupon + tax;
        
        req.session.coupon = { code: uppercaseCouponCode, discount: discountAmount };

        res.json({
            success: true,
            message: 'Coupon applied successfully!',
            discountAmount: discountAmount.toFixed(2),
            newGrandTotal: finalAmount.toFixed(2),
            discountType: coupon.discountType,
            discountValue: coupon.discountValue
        });

    } catch (error) {
        console.error("Apply coupon error:", error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.removeCoupon = async (req, res) => {
    try {
        // Remove the coupon from the session
        delete req.session.coupon;

        // Recalculate the original total (after offers, before coupon/tax)
        const userId = req.user._id;
        const cart = await Cart.findOne({ userId }).populate({ path: 'items.productId', populate: ['category_id', 'brand_id'] });
        let totalAfterOffers = 0;
        await Promise.all(cart.items.map(async (item) => {
            // ... [Same price calculation logic as in applyCoupon] ...
            const product = item.productId;
            const sizeVariant = product.colorVariants.find(c => c.colorName === item.colorName)?.variants.find(s => s.size === item.size);
            const originalPrice = sizeVariant ? sizeVariant.price : 0;
            const bestOffer = await findBestOffer(product._id, product.category_id?._id, product.brand_id?._id);
            let finalPrice = originalPrice;
            if (bestOffer) {
                finalPrice = originalPrice * (1 - bestOffer.discountPercentage / 100);
            }
            totalAfterOffers += finalPrice * item.quantity;
        }));

        const tax = totalAfterOffers * 0.05;
        const finalAmount = totalAfterOffers + tax;

        res.json({
            success: true,
            message: 'Coupon removed.',
            newGrandTotal: finalAmount.toFixed(2)
        });

    } catch (error) {
        console.error("Remove coupon error:", error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};