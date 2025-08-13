const express=require('express');
const router=express.Router();

const {isNotAuthenticated,isAuthenticated,isVerified}=require('../middlewares/user/authMiddleware.js') 
const userController = require('../controllers/user/userController.js');
const productController = require('../controllers/user/productController.js');
const productDetailController = require('../controllers/user/productDetailController.js');
const profileController = require('../controllers/user/profileController.js');
const cartController = require('../controllers/user/cartController.js');
const checkoutController = require('../controllers/user/checkoutController.js');

router.route('/home')
  .get(userController.getHome);

router.route('/product')
    .get(productController.getAllProducts);

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


router.get('/checkout',isAuthenticated,checkoutController.getCheckout);


      






module.exports=router;