const Razorpay = require('razorpay');
const crypto = require('crypto'); 
const Order = require("../../model/order.js");
const User = require("../../model/user.js");
const Product = require("../../model/product.js");
const Address = require("../../model/address.js");
const Cart = require("../../model/cart.js");
const Wallet = require('../../model/wallet.js');
const Coupon = require('../../model/coupon.js');
const {findBestOffer} = require('../../utils/offerHelper.js');
const {rewardReferralUsers} = require('../../utils/referralReward.js');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.placeOrder = async (req, res) => {
    try {
        const { addressId,paymentMethod } = req.body;
        const userId = req.user._id;
        const TAX_RATE = 0.05;
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
        for (const item of cart.items) {
           const product = await Product.findById(item.productId)
           .populate('category_id')
           .populate('brand_id')
           .lean();
            if (!product) {
                return res.status(400).json({ message: "One or more products in your cart are not available." });
            }
            if(product.isDeleted){
                 return res.status(400).json({ message: "One or more products tempererly deleted" });
            }
            if(!product.isListed){
                 return res.status(400).json({ message: "One or more products Not Listed" });
            }
            if(!product.category_id || !product.category_id.isListed){
                return res.status(400).json({message: 'Products Category is Didnt exists Or Not Listed.' });
            }
            if(!product?.brand_id || !product?.brand_id?.isListed){
            res.status(400).json({message: 'Products Brand is Didnt exists Or Not Listed.' });
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
            const originalPrice = sizeVariant.price;
            const bestOffer = await findBestOffer(product._id, product.category_id?._id, product.brand_id?._id);
            let finalPrice = originalPrice;
            if (bestOffer) {
                finalPrice = originalPrice * (1 - bestOffer.discountPercentage / 100);
            }
            originalSubtotal += originalPrice * item.quantity;
            totalAfterOffers += finalPrice * item.quantity;
            console.log(`total after offer : ${totalAfterOffers}`)
            productsToOrder.push({
                product_id: product._id,
                quantity: item.quantity,
                originalPrice: originalPrice,
                price: finalPrice,
                colorName: item.colorName,
                size: item.size,
            });
        }
        let couponDiscount = req.session.coupon?.discount || 0;
        let finalAmount = totalAfterOffers - couponDiscount;
        const tax = finalAmount > 0 ? finalAmount * TAX_RATE : 0;
        finalAmount += tax;
       if(finalAmount>50000){
            return res.status(400).json({message:'cannot place order above 5O Thousonds'});
        }
        console.log(`final amount ${finalAmount}`)
        let paymentStatus;
        let productStatus;
        if (paymentMethod === 'COD') {
            paymentStatus = 'PENDING'; 
            productStatus = 'CONFIRMED'; 
        } else if (paymentMethod === 'WALLET') {
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
            productStatus = 'CONFIRMED'; 
        } else {
            return res.status(400).json({ message: 'Invalid payment method.' });
        }
        productsToOrder.forEach(p => p.status = productStatus);
        const newOrder = new Order({
            user_id: userId,
            address_id: shippingAddress._id,
            products: productsToOrder,
            total_amount: finalAmount.toFixed(2),
            payment_status: paymentStatus,
            payment_method: paymentMethod,
            total_offer_applied: originalSubtotal - totalAfterOffers,
            coupon_discount: couponDiscount, 
            tax:tax
        });
        await newOrder.save();
       await rewardReferralUsers(userId, newOrder._id);
        if (paymentMethod === 'WALLET') {
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
            redirectUrl: `/payment/success?customId=${newOrder.order_id}&orderId=${newOrder._id}`
        });
    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).json({ message: "An internal server error occurred." });
    }
};



exports.createPaymentOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod } = req.body;
        const userId = req.user._id;
        let existingOrder = await Order.findOne({ user_id: userId,payment_status: { $in: ['PENDING', 'FAILED']}});

        const cart = await Cart.findOne({ userId }).populate({ path: 'items.productId', populate: ['category_id', 'brand_id']});
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: "Cart is empty." });
        }
        let totalAfterOffers = 0;
         let originalSubtotal = 0;
        const productsToOrder = [];
        for (const item of cart.items) {
           const product = await Product.findById(item.productId)
           .populate('category_id')
           .populate('brand_id')
           .lean();
            if (!product) {
                return res.status(400).json({ message: "One or more products in your cart are not available." });
            }
            if(product.isDeleted){
                 return res.status(400).json({ message: "One or more products tempererly deleted" });
            }
            if(!product.isListed){
                 return res.status(400).json({ message: "One or more products Not Listed" });
            }
            if(!product.category_id || !product.category_id.isListed){
                return res.status(400).json({message: 'Products Category is Didnt exists Or Not Listed.' });
            }
            if(!product?.brand_id || !product?.brand_id?.isListed){
            res.status(400).json({message: 'Products Brand is Didnt exists Or Not Listed.' });
            }
           const sizeVariant = product.colorVariants.find(c => c.colorName === item.colorName)?.variants.find(s => s.size === item.size);
           if (!sizeVariant || sizeVariant.stock < item.quantity) throw new Error('An item in your cart is unavailable.');
           const originalPrice = sizeVariant.price;
           const bestOffer = await findBestOffer(product._id, product.category_id?._id, product.brand_id?._id);
           let finalPrice = originalPrice;
           if (bestOffer) {
               finalPrice = originalPrice * (1 - bestOffer.discountPercentage / 100);
           }
           totalAfterOffers += finalPrice * item.quantity;
           originalSubtotal += originalPrice * item.quantity;
            productsToOrder.push({
                product_id: product._id,
                quantity: item.quantity,
                originalPrice: originalPrice,
                price: finalPrice,
                colorName: item.colorName,
                size: item.size
            });
        }
        let couponDiscount = req.session.coupon ? req.session.coupon.discount : 0;
        let finalAmount = totalAfterOffers - couponDiscount;
        const tax = finalAmount > 0 ? finalAmount * 0.05 : 0;
        finalAmount += tax;
        if(finalAmount>50000){
            return res.status(400).json({message:'cannot place order above 5O Thousonds'});
        }

        let orderDoc;
         if (existingOrder) {
  // Update existing order
  existingOrder.address_id = addressId;
  existingOrder.payment_method = paymentMethod;
  existingOrder.products = productsToOrder;
  existingOrder.total_amount = finalAmount.toFixed(2);
  existingOrder.payment_status = 'PENDING';
  existingOrder.total_offer_applied = originalSubtotal - totalAfterOffers;
  existingOrder.couponDiscount = couponDiscount;
  existingOrder.coupon_discount = couponDiscount;
  existingOrder.tax = tax;

  await existingOrder.save();
  orderDoc = existingOrder;
} else {
  // Create new order
  const newOrder = new Order({
    user_id: userId,
    address_id: addressId,
    products: productsToOrder,
    total_amount: finalAmount.toFixed(2),
    payment_status: 'PENDING',
    payment_method: paymentMethod,
    total_offer_applied: originalSubtotal - totalAfterOffers,
    couponDiscount: couponDiscount,
    coupon_discount: couponDiscount,
    tax: tax,
  });

   await newOrder.save();
   orderDoc = newOrder;
}
   const options = {
   amount: Math.round(finalAmount * 100),
   currency: "INR",
   receipt: orderDoc.order_id,
};
    const razorpayOrder = await razorpay.orders.create(options);
    orderDoc.payment_Id = razorpayOrder.id;
    await orderDoc.save();

    res.json({
    success: true,
    order: razorpayOrder,
    keyId: process.env.RAZORPAY_KEY_ID,
    dbOrderId: orderDoc._id,
    customId: orderDoc.order_id,
});
    } catch (error) {
        console.error("Error creating payment order:", error);
        res.status(500).json({ success: false, message: "Could not initiate payment." });
    }
};
exports.varifyPayment = async (req, res) => {
    try {
        const { payment, order, dbOrderId ,customId} = req.body;
        const userId = req.user._id;
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(payment.razorpay_order_id + "|" + payment.razorpay_payment_id);
        const generated_signature = hmac.digest('hex');

        if (generated_signature !== payment.razorpay_signature) {
            await Order.updateOne({ _id: dbOrderId }, { $set:{payment_status: 'FAILED','products.$[].status': 'PENDING'} });
            return res.status(400).json({ success: false, message: 'Payment verification failed.',redirectUrl: `/payment/failure?orderId=${dbOrderId}&customId=${customId}` });
        }
        const currentOrder = await Order.findById(dbOrderId).populate({
            path: 'products.product_id',
            model: 'Product' 
        });
        if (!currentOrder) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }
        const validProductsInOrder = currentOrder.products.filter(item => item.product_id);
        if (validProductsInOrder.length !== currentOrder.products.length) {
            await Order.updateOne({ _id: dbOrderId }, { $set: {payment_status: 'FAILED','products.$[].status': 'PENDING'}});
            return res.json({ success: false, message: `A product in your order is no longer available. Your payment will be refunded.`,redirectUrl: `/payment/failure?orderId=${dbOrderId}&customId=${customId}` });
        }
        for (const item of validProductsInOrder) {
            const product = item.product_id;
            const sizeVariant = product.colorVariants
                .find(c => c.colorName === item.colorName)?.variants
                .find(s => s.size === item.size);

            if (!sizeVariant || sizeVariant.stock < item.quantity) {
                await Order.updateOne({ _id: dbOrderId }, { $set:{payment_status: 'FAILED','products.$[].status': 'PENDING'}});
                return res.json({ success: false, message: `Stock for ${product.title} is no longer available. Your payment will be refunded.`, redirectUrl: `/payment/failure?orderId=${dbOrderId}&customId=${customId}` });
            }
        }
        await Order.updateOne(
            { _id: dbOrderId }, 
            { $set: { payment_status: 'COMPLETED' },'products.$[].status':'CONFIRMED'}
        );
       await rewardReferralUsers(userId, dbOrderId);
        if (req.session.coupon) {
            await Coupon.updateOne({ code: req.session.coupon.code }, { $push: { usedBy: userId } });
        }
        
        for (const item of validProductsInOrder) {
            await Product.updateOne(
                { "_id": item.product_id._id, "colorVariants.colorName": item.colorName, "colorVariants.variants.size": item.size },
                { $inc: { "colorVariants.$[c].variants.$[v].stock": -item.quantity } },
                { "arrayFilters": [{ "c.colorName": item.colorName }, { "v.size": item.size }] }
            );
        }
        await Cart.deleteOne({ userId: userId });
        delete req.session.coupon;
        res.json({ success: true, redirectUrl: `/payment/success?customId=${customId}&orderId=${dbOrderId}` });
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ success: false, message: "Server error during verification." });
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
