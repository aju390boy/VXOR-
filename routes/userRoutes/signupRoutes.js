const express = require('express');
const router = express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const signupController=require('../../controllers/user/signupController.js')



router.route('/')
  .get(isNotAuthenticated, signupController.signup)   
  .post(signupController.signupadd);                 



  module.exports = router;