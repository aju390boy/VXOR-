const express = require('express');
const router = express.Router();
const multer=require('multer');

const dashboardController=require('../controllers/admin/dashboardController.js')
const customerController=require('../controllers/admin/customerController.js')
const authController=require('../controllers/admin/authController.js')
const productController = require('../controllers/admin/productController.js');
const { isAuthenticated, isNotAuthenticated } = require('../middlewares/admin/viewsMiddleware.js');
const {multerErrorHandler} = require('../middlewares/admin/multerErrorHandler.js');
const {upload} = require('../middlewares/admin/upload.js');
const brandController=require('../controllers/admin/brandController.js')
const addProductController=require('../controllers/admin/addProductController.js');
const orderController=require('../controllers/admin/orderController.js')
const orderdetailController = require('../controllers/admin/orderdetailController.js');
const offerController = require('../controllers/admin/offerController.js');
const couponController = require('../controllers/admin/couponController.js');
const salesController = require('../controllers/admin/salesController.js');
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


//Add Products\\\
router.route('/addproducts')
.get(isAuthenticated,addProductController.getAddProductPage)
.post(upload.any(), 
    multerErrorHandler,
    addProductController.addProduct
);
////edit product////
router.route('/editproduct/:id')
.get(isAuthenticated, addProductController.getEditProductPage)
.patch( isAuthenticated,
    upload.any(), 
    multerErrorHandler,
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




/////orders///
router.get('/orders', isAuthenticated, orderController.renderOrdersPage);
router.get('/api/orders', isAuthenticated, orderController.getOrders);
////currently not using this,we can use this in order detail page//////// 
router.patch('/api/orders/:orderId/status', isAuthenticated, orderController.updateOrderStatus);


///order detail////
router.get('/api/orders/:orderId', isAuthenticated, orderdetailController.getSingleOrder);
//////new logic for order detail page/////////
// Update product item status
router.patch('/orders/:orderId/products/:productId/status',isAuthenticated, orderdetailController.updateProductStatus);
// Update product item expected delivery date
router.patch('/orders/:orderId/products/:productId/expected-delivery', isAuthenticated, orderdetailController.updateProductExpectedDelivery);
// Approve or Reject cancellation/return request for product or order
router.post('/orders/:orderId/request-action',isAuthenticated, orderdetailController.handleOrderRequestAction);
router.post('/orders/:orderId/products/:productId/request-action',isAuthenticated, orderdetailController.handleProductRequestAction);


///Dashboard\\\
router.get('/dashboard',isAuthenticated, dashboardController.getDashboard);

///sales///
router.get('/sales',isAuthenticated,salesController.renderSalesPage);
router.get('/sales/download/pdf',isAuthenticated,salesController.downloadPdfReport);
router.get('/sales/download/excel',isAuthenticated,salesController.downloadExcelReport)

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
