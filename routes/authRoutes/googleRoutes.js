const express = require('express');
const passport = require('passport');
const router = express.Router();
const loginController = require('../../controllers/user/loginController.js');


router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  loginController.googleLoginSuccess
);

module.exports = router;