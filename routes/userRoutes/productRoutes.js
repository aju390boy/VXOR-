const express = require('express');
const router=express.Router();
const productController = require('../../controllers/user/productController.js');
const productDetailController = require('../../controllers/user/productDetailController.js');
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');


router.route('/')
      .get(isAuthenticated, productController.getAllProducts);
router.get('/search',isAuthenticated, productController.liveSearch);
router.get('/variants/:productId',isAuthenticated, productController.getProductVariants);
router.get('/:id',isAuthenticated, productDetailController.getSingleProduct);

module.exports = router;