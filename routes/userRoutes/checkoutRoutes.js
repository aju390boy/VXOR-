const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const checkoutController = require('../../controllers/user/checkoutController.js');
const placeorderController = require('../../controllers/user/placeorderController.js');


router.get('/',isAuthenticated,isVerified,checkoutController.getCheckout);
router.post('/apply-coupon',isAuthenticated, isVerified,checkoutController.applyCoupon);
router.post('/remove-coupon',isAuthenticated, isVerified,checkoutController.removeCoupon);
router.post('/address/set-default/:addressId',isAuthenticated, isVerified,placeorderController.setDefaultAddress);



module.exports = router;