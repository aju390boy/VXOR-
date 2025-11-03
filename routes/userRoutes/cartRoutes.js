const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const cartController = require('../../controllers/user/cartController.js');


router.route('/')
      .post( isAuthenticated, cartController.addToCart)
      .get( isAuthenticated, cartController.getCart);
router.patch('/update-quantity/:itemId', isAuthenticated, cartController.updateCartQunty);
router.delete('/remove-item/:itemId', isAuthenticated, cartController.removeCartItm);
router.get('/count',isAuthenticated,cartController.getCartCount);


module.exports = router;