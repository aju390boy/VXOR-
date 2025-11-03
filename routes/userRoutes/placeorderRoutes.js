const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const placeorderController = require('../../controllers/user/placeorderController.js');


router.post('/verify-payment',isAuthenticated,isVerified,placeorderController.varifyPayment);
router.post('/create-payment-order',isAuthenticated,isVerified,placeorderController.createPaymentOrder);
router.post('/place-order',isAuthenticated,isVerified,placeorderController.placeOrder);


module.exports = router;