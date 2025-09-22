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
const orderController=require('../controllers/user/orderController.js');
const wishlistController=require('../controllers/user/wishlistController.js')
const walletController = require('../controllers/user/walletController.js');

router.route('/home')
  .get(userController.getHome);

router.route('/product')
    .get(isAuthenticated, productController.getAllProducts);

router.get('/product-search', productController.liveSearch);
router.get('/product-variants/:productId', productController.getProductVariants);

///product Detail\\\\\

router.get('/product/:id', productDetailController.getSingleProduct);


router.route('/category')
    .get(isAuthenticated);
  
router.route('/productDetails')
    .get(isAuthenticated);

router.get('/profile',isAuthenticated,isVerified,profileController.getProfilePage);

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


///wishlist///
router.post('/wishlist/add/:productId', wishlistController.addToWishlist);
router.delete('/wishlist/remove/:productId', wishlistController.removeFromWishlist);

////wallet////
router.post('/wallet/add-money', walletController.createWalletOrder);
router.post('/wallet/verify-payment', walletController.verifyWalletPayment);

//////cart////
// Route to add a product to the user's cart
router.route('/cart')
.post( isAuthenticated, cartController.addToCart)
.get( isAuthenticated, cartController.getCart);
router.patch('/cart/update-quantity/:itemId', isAuthenticated, cartController.updateCartQunty);
router.delete('/cart/remove-item/:itemId', isAuthenticated, cartController.removeCartItm);
router.get('/cart/count',isAuthenticated,cartController.getCartCount);

////checkout////place order////success////
router.get('/checkout',isAuthenticated,checkoutController.getCheckout);
router.post('/apply-coupon', checkoutController.applyCoupon);
router.post('/remove-coupon', checkoutController.removeCoupon);
router.post('/verify-payment',isAuthenticated,placeorderController.varifyPayment);
router.post('/create-payment-order',isAuthenticated,placeorderController.createPaymentOrder);
router.post('/place-order',isAuthenticated,placeorderController.placeOrder);
router.post('/checkout/address/set-default/:addressId',isAuthenticated, placeorderController.setDefaultAddress);
router.get('/success',isAuthenticated,successController.getSuccess);
router.get('/failure',isAuthenticated,successController.getFailure);
router.post('/order-failed', successController.handleFailedOrder);

///orders routes///
router.get('/orders/search',isAuthenticated,orderController.searchUserOrders)


////order detail routes/////

// View a specific order's details.
router.get('/orders/:orderId', isAuthenticated, orderdetailController.getOrderDetail);

// Download the invoice for the entire order.
router.get('/orders/:orderId/invoice', isAuthenticated,orderdetailController.downloadInvoice);
// Download invoice for a single item.
router.get('/orders/:orderId/items/:itemId/invoice', isAuthenticated, orderdetailController.downloadSingleInvoice);

//  Request to cancel a single item.
router.patch('/orders/:orderId/items/:itemId/request-cancellation', isAuthenticated, orderdetailController.requestItemCancellation);
// Request to cancel all eligible items in an order.
router.patch('/orders/:orderId/request-cancellation', isAuthenticated, orderdetailController.requestEntireOrderCancellation);

//  Request to return a single item.
router.patch('/orders/:orderId/items/:itemId/request-return', isAuthenticated, orderdetailController.requestItemReturn);
//  Request to return all eligible items in an order.
router.patch('/orders/:orderId/request-return', isAuthenticated,orderdetailController.requestEntireOrderReturn);






      






module.exports=router;