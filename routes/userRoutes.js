const express=require('express');
const router=express.Router();

const {isNotAuthenticated,isAuthenticated,isVerified}=require('../middlewares/user/authMiddleware.js') 
const userController = require('../controllers/user/userController.js');
const productController = require('../controllers/user/productController.js');
const productDetailController = require('../controllers/user/productDetailController.js');
const profileController = require('../controllers/user/profileController.js');


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






module.exports=router;