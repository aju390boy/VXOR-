const express=require('express');
const router=express.Router();

const {isNotAuthenticated,isAuthenticated,isVerified}=require('../middlewares/user/authMiddleware.js') 
const userController = require('../controllers/user/userController.js');
const productController = require('../controllers/user/productController.js');
const productDetailController = require('../controllers/user/productDetailController.js');
const profileController = require('../controllers/user/profileController.js');
const cartController = require('../controllers/user/cartController.js');
const checkoutController = require('../controllers/user/checkoutController.js');
const placeorderController = require('../controllers/user/placeorderController.js');
const successController = require('../controllers/user/successController.js');
const orderdetailController = require('../controllers/user/orderdetailController..js');
const orderController=require('../controllers/user/orderController.js')

router.route('/home')
  .get(userController.getHome);

router.route('/product')
    .get(isAuthenticated, productController.getAllProducts);

router.get('/product-search', productController.liveSearch);

///product Detail\\\\\

router.get('/product/:id', productDetailController.getSingleProduct);


router.route('/category')
    .get(isAuthenticated);
  
router.route('/productDetails')
    .get(isAuthenticated);

router.get('/profile',isAuthenticated,profileController.getProfilePage);

// individual profile sections 
router.get('/profile/section/:sectionName',isAuthenticated, profileController.getProfileSection);
// profile changing password
router.post('/profile/change-password',isAuthenticated,profileController.changePassword);
router.post('/profile/update', isAuthenticated, profileController. upload.single('profileImage') ,profileController.updateProfile);
router.post('/verify-email-update',isAuthenticated,profileController.verifyEmailUpdate);
router.post('/resend-email-otp',isAuthenticated,profileController.resendEmailUpdateOtp);
////profile address routes
router.post('/profile/address/add', isAuthenticated, profileController.addAddress);
router.post('/profile/address/edit/:addressId', isAuthenticated, profileController.editAddress);
router.post('/profile/address/remove/:addressId', isAuthenticated, profileController.removeAddress);
router.post('/profile/address/set-default/:addressId',isAuthenticated, profileController.setDefaultAddress);

//////cart////
// Route to add a product to the user's cart
// The 'protect' middleware ensures the user is authenticated and `req.user` is available
router.route('/cart')
.post( isAuthenticated, cartController.addToCart)
.get( isAuthenticated, cartController.getCart);
router.patch('/cart/update-quantity/:itemId', isAuthenticated, cartController.updateCartQunty);
router.delete('/cart/remove-item/:itemId', isAuthenticated, cartController.removeCartItm);
router.get('/cart/count',isAuthenticated,cartController.getCartCount);

////checkout////place order////success////
router.get('/checkout',isAuthenticated,checkoutController.getCheckout);
router.post('/place-order/cod',isAuthenticated,placeorderController.placeOrder);
router.post('/checkout/address/set-default/:addressId',isAuthenticated, placeorderController.setDefaultAddress);
router.get('/success',isAuthenticated,successController.getSuccess);

///orders routes///
router.get('/orders/search',isAuthenticated,orderController.searchUserOrders)

////order detail routes/////
router.get('/order-detail', isAuthenticated, orderdetailController.getOrderDetail);
router.post('/cancel-item',isAuthenticated, orderdetailController.cancelItem);
router.post('/return-item',isAuthenticated, orderdetailController.returnItem);
router.get('/invoice',isAuthenticated, orderdetailController.downloadInvoice);




      






module.exports=router;