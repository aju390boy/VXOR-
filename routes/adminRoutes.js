const express = require('express');
const router = express.Router();
const multer=require('multer');

const dashboardController=require('../controllers/admin/dashboardController.js')
const customerController=require('../controllers/admin/customerController.js')
const authController=require('../controllers/admin/authController.js')
const productController = require('../controllers/admin/productController.js');
const { isAuthenticated, isNotAuthenticated } = require('../middlewares/admin/viewsMiddleware.js');
const brandController=require('../controllers/admin/brandController.js')
const addProductController=require('../controllers/admin/addProductController.js');
const orderController=require('../controllers/admin/orderController.js')
const orderdetailController = require('../controllers/admin/orderdetailController.js');
const offerController = require('../controllers/admin/offerController.js');
const couponController = require('../controllers/admin/couponController.js');
const {
  addCategory,
  getCategories,
  toggleCategoryStatus,
  loadEditForm,
  editCategory,
  deleteCategory
} = require('../controllers/admin/catController.js');



router.route('/login')
.get( isNotAuthenticated,authController.getAdminLoginPage)
.post( authController.postAdminLogin);



///Customers\\\\
router.get('/customers', isAuthenticated, customerController.getCustomers);
router.post('/customers/:id/block', isAuthenticated, customerController.blockCustomer);
router.post('/customers/:id/unblock',  isAuthenticated,customerController.unblockCustomer);
router.get('/customers-search', customerController.getCustomersAjax);





// category management 
router.get('/category',isAuthenticated, getCategories);
router.post('/category/add', addCategory);
router.post('/category/toggle/:id', toggleCategoryStatus);
router.get('/category/edit/:id', loadEditForm);
router.post('/category/edit/:id', editCategory);
router.post('/category/delete/:id', deleteCategory);



router.route('/editproduct/:id')
.get(isAuthenticated, addProductController.getEditProductPage)
.post( isAuthenticated,
    addProductController.upload.any(), 
    (err, req, res, next) => {
        if (err instanceof multer.MulterError) {
            console.error("Multer error:", err.message);
            return res.status(400).json({ message: "File upload error: " + err.message });
        } else if (err && err.code === 'FILE_TYPE_ERROR') {
            console.error("File type error:", err.message);
            return res.status(400).json({ message: err.message });
        } else if (err) {
            console.error("Unknown file upload error:", err);
            return res.status(500).json({ message: "An unexpected error occurred during file upload." });
        }
        next();
    },
   addProductController.updateProduct
);
// products
router.get('/products',isAuthenticated, productController.getAllProducts);
router.post('/products/delete/:id', productController.softDelete);
router.post('/products/restore/:id', productController.softRestore);
router.get('/products-search', productController.getProductsAjax);


///Brand Routes\\\\
router.get('/brand', isAuthenticated,brandController.getBrands);
router.post('/brand/add', brandController.uploadBrandImage.single('image'), brandController.addBrand);
router.post('/brand/toggle/:id', brandController.toggleBrandStatus);
router.post('/brand/edit/:id', brandController.uploadBrandImage.single('image'), brandController.editBrand);
router.post('/brand/delete/:id', brandController.deleteBrand);


//Add Products\\\
router.route('/addproducts')
.get(isAuthenticated,addProductController.getAddProductPage)
.post(addProductController.upload.any(), 
    (err, req, res, next) => {
        
        if (err instanceof multer.MulterError) {
            console.error("Multer error:", err.message);
            
            return res.status(400).json({ message: "File upload error: " + err.message });
        } else if (err && err.code === 'FILE_TYPE_ERROR') {
            console.error("File type error:", err.message);
            return res.status(400).json({ message: err.message });
        } else if (err) {
           
            console.error("Unknown file upload error:", err);
            return res.status(500).json({ message: "An unexpected error occurred during file upload." });
        }
        next(); 
    },
   
    addProductController.addProduct
);

/////orders///
router.get('/orders', isAuthenticated, orderController.renderOrdersPage);
router.get('/api/orders', isAuthenticated, orderController.getOrders);
router.patch('/api/orders/:orderId/status', isAuthenticated, orderController.updateOrderStatus);
///order detail////
router.get('/api/orders/:orderId', isAuthenticated, orderdetailController.getSingleOrder);
router.patch('/api/orders/:orderId/cancel', isAuthenticated, orderdetailController.cancelOrderItem);
router.patch('/api/orders/:orderId/return', isAuthenticated, orderdetailController.processReturnRequest);
router.patch('/api/orders/:orderId/products/:productId/status', orderdetailController.updateProductStatusInOrder);



///Dashboard\\\
router.get('/dashboard',isAuthenticated, dashboardController.getDashboard);


////offer////
// GET /admin/offers - Display all offers
router.get('/offers', offerController.getAllOffers);
// POST /admin/offers - Create a new offer
router.post('/offers', offerController.createOffer);
// PUT /admin/offers/:id - Update an offer
router.put('/offers/:id', offerController.updateOffer);
// PATCH /admin/offers/:id/toggle - Toggle offer status
router.patch('/offers/:id/toggle', offerController.toggleOfferStatus);
// DELETE /admin/offers/:id - Delete an offer
router.delete('/offers/:id', offerController.deleteOffer);


////coupon/////
// GET /admin/coupons - Display all coupons
router.get('/coupons', couponController.getAllCoupons);
// POST /admin/coupons - Create a new coupon
router.post('/coupons', couponController.createCoupon);
// PUT /admin/coupons/:id - Update a coupon
router.put('/coupons/:id', couponController.updateCoupon);
// PATCH /admin/coupons/:id/toggle - Toggle coupon status
router.patch('/coupons/:id/toggle', couponController.toggleCouponStatus);
// DELETE /admin/coupons/:id - Delete a coupon
router.delete('/coupons/:id', couponController.deleteCoupon);


////logout\\\\
router.post('/logout', authController.logoutUser);

module.exports = router;
