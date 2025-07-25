const express = require('express');
const passport = require('passport');
const router = express.Router();

const authController = require('../controllers/user/authController.js');
const { isAuthenticated, isNotAuthenticated } = require('../middlewares/user/viewsMiddleware.js');


router.get('/',(req,res)=>{
    res.redirect('/user/home')
})


// router.route('/landig') 
//   .get(authController.isLanding);


router.route('/login')
  .get(isNotAuthenticated, authController.login)   
  .post(isNotAuthenticated, authController.postLogin); 

router.route('/signup')
  .get(isNotAuthenticated, authController.signup)   
  .post(authController.signupadd);                 

  ///FORGOT PASSWORD\\\\
  router.get('/forgot-password', authController.getForgotPage);
  // Handle “Send me an OTP”
  router.post('/forgot-password', authController.postForgotPassword);

// Handle “Verify OTP”
router.get('/verify-otp', authController.getOtpPage);
router.post('/verify-otp', authController.postVerifyOtp);

// Handle “Set new password”
router.get('/reset-password', authController.getResetPage);
router.post('/reset-password', authController.postResetPassword);



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