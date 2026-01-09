
const express = require('express');
const router = express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const otpController = require('../../controllers/user/otpController.js');


  router.route('/')
  .get(isNotAuthenticated,otpController.getForgotPage)
  .post(isNotAuthenticated, otpController.postForgotPassword);

  router.route('/')
  .get(isNotAuthenticated, otpController.getOtpPage)
  .post('/',isNotAuthenticated, otpController.postVerifyOtp);


module.exports = router;