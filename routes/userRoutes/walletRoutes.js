const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const walletController = require('../../controllers/user/walletController.js');


router.post('/add-money', walletController.createWalletOrder);
router.post('/verify-payment', walletController.verifyWalletPayment);


module.exports = router;
