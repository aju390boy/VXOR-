const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const cartController = require('../../controllers/user/cartController.js');


router.route('/')
      .post( isAuthenticated,isVerified, cartController.addToCart)
      .get( isAuthenticated, isVerified,cartController.getCart);
router.patch('/update-quantity/:itemId', isAuthenticated,isVerified, cartController.updateCartQunty);
router.delete('/remove-item/:itemId', isAuthenticated,isVerified, cartController.removeCartItm);
router.get('/count',isAuthenticated,isVerified,cartController.getCartCount);


module.exports = router;