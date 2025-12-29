const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const successController = require('../../controllers/user/successController.js');


router.get('/success',isAuthenticated,isVerified,successController.getSuccess);
router.get('/failure',isAuthenticated,isVerified,successController.getFailure);
router.post('/order-failed',isAuthenticated,isVerified, successController.handleFailedOrder);

module.exports = router;