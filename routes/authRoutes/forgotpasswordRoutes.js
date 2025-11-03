const express = require('express');
const router = express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const forgotpasswordController = require('../../controllers/user/forgotpasswordController.js');


  router.route('/')
  .get(isNotAuthenticated,forgotpasswordController.getForgotPage)
  .post(isNotAuthenticated, forgotpasswordController.postForgotPassword);


module.exports = router;