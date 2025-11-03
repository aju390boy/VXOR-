const express = require('express');
const router=express.Router();
const productController = require('../../controllers/user/productController.js');
const productDetailController = require('../../controllers/user/productDetailController.js');
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');


router.route('/')
      .get(isAuthenticated,isVerified, productController.getAllProducts);
router.get('/search', productController.liveSearch);
router.get('/variants/:productId', productController.getProductVariants);
router.get('/:id', productDetailController.getSingleProduct);

module.exports = router;