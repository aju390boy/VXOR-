const express = require('express');
const router=express.Router();

const loginRoutes = require('./loginRoutes.js');
const singupRoutes = require('./signupRoutes.js');
const logoutRoutes = require('./logoutRoutes.js');
const forgotpasswordRoutes = require('./forgotpasswordRoutes.js');
const verifyotpRoutes = require('./verifyotpRoutes.js');
const resetpasswordRoutes = require('./resetpasswordRoutes.js');
const resendotpRoutes = require('./resendoptRoutes.js');
const googleRoutes = require('./googleRoutes.js');
const homeRoutes = require('./homeRoutes.js');

router.use('/',homeRoutes);
router.use('/login',loginRoutes);
router.use('/logout',logoutRoutes);
router.use('/signup',singupRoutes);
router.use('/forgot-password',forgotpasswordRoutes);
router.use('/verify-otp',verifyotpRoutes);
router.use('/reset-password',resetpasswordRoutes);
router.use('/resend-otp',resendotpRoutes);
router.use('/auth',googleRoutes);

module.exports = router;