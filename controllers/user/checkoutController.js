const User = require('../../model/user.js');
const Cart = require('../../model/cart.js');
const Product = require('../../model/product.js');
const Address = require('../../model/address.js')


exports.getCheckout = async (req, res) => {
    const TAX_RATE = 0.05;
    try {
        const cart = await Cart.findOne({ userId: req.user._id }).populate({
            path: 'items.productId',
            model: 'Product',
            populate: [
                { path: 'colorVariants.variants' }
            ]
        });

        if (!cart || cart.items.length === 0) {
            return res.redirect('/user/cart');
        }
        
        let toastMessage = null;
        const unavailableItems = cart.items.filter(item => {
            const product = item.productId;
            if (!product) return true; 
            const colorVariant = product.colorVariants.find(c => c.colorName === item.colorName);
            if (!colorVariant) return true; 
            const sizeVariant = colorVariant.variants.find(s => s.size === item.size);
            if (!sizeVariant || sizeVariant.stock < item.quantity) {
                return true;
            }
            return false;
        });
        if (unavailableItems.length > 0) {
            toastMessage = {
                icon: 'error',
                text: 'One or more items in your cart are now out of stock. Please remove them to proceed.'
            };
        }
        const defaultAddress = await Address.findOne({ user_id: req.user._id, isDefault: true });
         const allAddresses = await Address.find({ user_id: req.user._id });
        if (!defaultAddress) {
            toastMessage = {
                icon: 'error',
                text: 'Please add a default address before proceeding to checkout.'
            };
        }
        let subtotal = 0;
        cart.items.forEach(item => {
            const product = item.productId;
            const colorVariant = product.colorVariants.find(c => c.colorName === item.colorName);
            const sizeVariant = colorVariant ? colorVariant.variants.find(s => s.size === item.size) : null;
            if (sizeVariant && sizeVariant.stock >= item.quantity) {
                subtotal += sizeVariant.price * item.quantity;
            }
        });
        const tax = subtotal * TAX_RATE;
        const couponDiscount = 0; 
        const isCodAvailable ={a:0,b:0}
          
        const total = subtotal + tax - couponDiscount;
        res.render('user/checkout', {
            title: 'Checkout',
            user: req.user,
            isCodAvailable ,
            allAddresses,
            address: defaultAddress,
            cartItems: cart.items,
            subtotal: subtotal.toFixed(2),
            tax: tax.toFixed(2),
            couponDiscount: couponDiscount.toFixed(2),
            total: total.toFixed(2),
            toastMessage: toastMessage
        });
    } catch (error) {
        console.error('Error in getCheckout:', error);
        res.status(500).render('error', { title: 'Error', message: 'Something went wrong.' });
    }
};
