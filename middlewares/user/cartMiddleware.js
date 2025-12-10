const Cart = require('../../model/cart.js');

const getCartCount = async (req, res, next) => {
    console.log('get cart count hitted.........................')
    res.locals.cartCount = 0;
    if (req.user) {
        const cart = await Cart.findOne({ userId: req.user._id });
        if (cart) {
            
            const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
            res.locals.cartCount = count;
            console.log(   `cart count : ${res.locals.cartCount}`)
        }
    }
    next();
};
module.exports = { getCartCount };
