const express = require('express');
const router=express.Router();
const multer = require('multer');
const {multerErrorHandler} = require('../../middlewares/admin/multerErrorHandler.js');
const {upload} = require('../../middlewares/admin/upload.js');
const { isAuthenticated, isNotAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');
const productController = require('../../controllers/admin/productController.js');
const addProductController=require('../../controllers/admin/addProductController.js');

router.route('/add')
.get(isAuthenticated,addProductController.getAddProductPage)
.post(upload.any(), 
    multerErrorHandler,
    addProductController.addProduct
);
router.route('/edit/:id')
.get(isAuthenticated, addProductController.getEditProductPage)
.patch( isAuthenticated,
    upload.any(), 
    multerErrorHandler,
   addProductController.updateProduct
);
router.get('/',isAuthenticated, productController.getAllProducts);
router.post('/delete/:id',isAuthenticated, productController.softDelete);
router.post('/restore/:id',isAuthenticated, productController.softRestore);
router.get('/search',isAuthenticated, productController.getProductsAjax);
router.patch('/:id/toggle-list', isAuthenticated,productController.toggleProductListing);

module.exports = router;