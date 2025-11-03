const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const wishlistController = require('../../controllers/user/wishlistController.js');


router.post('/add/:productId', wishlistController.addToWishlist);
router.delete('/remove/:productId', wishlistController.removeFromWishlist);


module.exports = router;