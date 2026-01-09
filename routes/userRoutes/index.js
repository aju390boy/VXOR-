const express = require('express');
const router=express.Router();

const loginRoutes = require('./loginRoutes.js');
const singupRoutes = require('./signupRoutes.js');
const logoutRoutes = require('./logoutRoutes.js');
const forgotpasswordRoutes = require('./forgotpasswordRoutes.js');
const verifyotpRoutes = require('./verifyotpRoutes.js');
const resetpasswordRoutes = require('./resetpasswordRoutes.js');
const resendotpRoutes = require('./resendoptRoutes.js');
const googleRoutes = require('./googleRoutes.js');
const homeRoutes = require('./homeRoutes.js');
/////////////user routes/////////////
const homeRoutesForUsers = require('./homeRoutesForUser.js');
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

router.use('/',homeRoutes);
router.use('/login',loginRoutes);
router.use('/logout',logoutRoutes);
router.use('/signup',singupRoutes);
router.use('/forgot-password',forgotpasswordRoutes);
router.use('/verify-otp',verifyotpRoutes);
router.use('/reset-password',resetpasswordRoutes);
router.use('/resend-otp',resendotpRoutes);
router.use('/auth',googleRoutes);
///////user routes///////
router.use('/home',homeRoutesForUsers);
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