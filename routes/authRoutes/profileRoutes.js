const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const {imageUploadMiddleware}=require('../../middlewares/user/imageMiddleware.js');
const profileController = require('../../controllers/user/profileController.js');


router.get('/',isAuthenticated,isVerified,profileController.getProfilePage);
router.get('/section/:sectionName',isAuthenticated, isVerified,profileController.getProfileSection);
router.post('/change-password',isAuthenticated,isVerified,profileController.changePassword);
router.post('/update',isAuthenticated,isVerified,imageUploadMiddleware,profileController.updateProfile);

router.post('/verify-email-update',isAuthenticated,isVerified,profileController.verifyEmailUpdate);
router.post('/resend-email-otp',isAuthenticated,isVerified,profileController.resendEmailUpdateOtp);

router.post('/address/add', isAuthenticated, isVerified,profileController.addAddress);
router.post('/address/edit/:addressId', isAuthenticated,isVerified, profileController.editAddress);
router.post('/address/remove/:addressId', isAuthenticated, isVerified,profileController.removeAddress);
router.post('/address/set-default/:addressId',isAuthenticated,isVerified, profileController.setDefaultAddress);

router.post('/generate-referral',isAuthenticated,isVerified,profileController.generateReferralCode);


module.exports = router;