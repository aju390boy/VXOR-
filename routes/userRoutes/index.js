const express = require('express');
const router=express.Router();
const homeRoutes = require('./homeRoutes.js');
const productRoutes = require('./productRoutes.js')
const profileRoutes = require('./profileRoutes.js')
const wishlistRoutes = require('./wishlistRoutes.js');
const walletRoutes = require('./walletRoutes.js');
const cartRoutes = require('./cartRoutes.js');
const checkoutRoutes = require('./checkoutRoutes.js');
const placeorderRoutes = require('./placeorderRoutes.js');
const paymentRoutes = require('./paymentRoutes.js');
const orderRoutes = require('./orderRoutes.js');
const aboutRoutes = require('./aboutRoutes.js');
const contactRoutes = require('./contactRoutes.js');

router.use('/home',homeRoutes);
router.use('/product',productRoutes);
router.use('/profile',profileRoutes);
router.use('/wishlist',wishlistRoutes);
router.use('/wallet',walletRoutes);
router.use('/cart',cartRoutes);
router.use('/checkout',checkoutRoutes);
router.use('/placeorder',placeorderRoutes);
router.use('/payment',paymentRoutes);
router.use('/orders',orderRoutes);
router.use('/about',aboutRoutes);
router.use('/contact',contactRoutes);


module.exports = router;