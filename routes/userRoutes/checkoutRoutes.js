const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const checkoutController = require('../../controllers/user/checkoutController.js');
const placeorderController = require('../../controllers/user/placeorderController.js');


router.get('/',isAuthenticated,checkoutController.getCheckout);
router.post('/apply-coupon', checkoutController.applyCoupon);
router.post('/remove-coupon', checkoutController.removeCoupon);
router.post('/address/set-default/:addressId',isAuthenticated, placeorderController.setDefaultAddress);



module.exports = router;