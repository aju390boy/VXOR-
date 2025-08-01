const express = require('express');
const passport = require('passport');
const router = express.Router();

const authController = require('../controllers/user/authController.js');
const signupController=require('../controllers/user/signupController.js')
const otpController=require('../controllers/user/otpController.js')

const viewsMiddleware  = require('../middlewares/user/viewsMiddleware.js');
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../middlewares/user/authMiddleware.js')


router.get('/',(req,res)=>{
    res.redirect('/user/home')
})



router.route('/login')
  .get(authController.login)   
  .post(authController.postLogin); 

router.route('/signup')
  .get(isNotAuthenticated, signupController.signup)   
  .post(signupController.signupadd);                 

  
  router.get('/forgot-password', isNotAuthenticated,otpController.getForgotPage);
  router.post('/forgot-password',isNotAuthenticated, otpController.postForgotPassword);


router.get('/verify-otp',isNotAuthenticated, otpController.getOtpPage);
router.post('/verify-otp',isNotAuthenticated, otpController.postVerifyOtp);


router.get('/reset-password', isNotAuthenticated,otpController.getResetPage);
router.post('/reset-password', otpController.postResetPassword);

router.post('/resend-otp', isNotAuthenticated,otpController.postResendOtp);

/////google signup\\\\\
  router.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  authController.googleLoginSuccess
);

router.get('/logout', authController.logoutUser);

module.exports = router;