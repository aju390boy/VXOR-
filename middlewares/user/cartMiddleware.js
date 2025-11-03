const Cart = require('../../model/cart.js')

const getCartCount = async (req, res, next) => {
    res.locals.cartCount = 0;
    if (req.user) {
        const cart = await Cart.findOne({ userId: req.user._id });
        if (cart) {
            
            const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
            res.locals.cartCount = count;
        }
    }
    next();
};

module.exports = { getCartCount };
