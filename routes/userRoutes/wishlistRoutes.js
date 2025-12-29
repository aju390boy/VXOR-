const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const wishlistController = require('../../controllers/user/wishlistController.js');


router.post('/add/:productId',isAuthenticated,isVerified, wishlistController.addToWishlist);
router.delete('/remove/:productId',isAuthenticated, isVerified,wishlistController.removeFromWishlist);


module.exports = router;