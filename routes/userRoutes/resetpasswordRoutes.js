const express = require('express');
const router = express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const resetpasswordController = require('../../controllers/user/resetpasswordController.js');



router.route('/')
.get(isNotAuthenticated,resetpasswordController.getResetPage)
.post(resetpasswordController.postResetPassword);





module.exports = router;