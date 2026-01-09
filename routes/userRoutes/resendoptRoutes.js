
const express = require('express');
const router = express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const otpController=require('../../controllers/user/otpController.js');




router.post('/', isNotAuthenticated,otpController.postResendOtp);

module.exports = router;
