const express = require('express');
const router = express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const loginController = require('../../controllers/user/loginController');



router.post('/', loginController.loginPost);
router.get('/',isNotAuthenticated, loginController.login);


module.exports = router;