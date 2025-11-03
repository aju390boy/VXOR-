
const express = require('express');
const router = express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const verifyotpController = require('../../controllers/user/verifyotpController.js');







 router.route('/')
  .get(isNotAuthenticated, verifyotpController.getOtpPage)
  .post(isNotAuthenticated, verifyotpController.postVerifyOtp);


  module.exports = router;
