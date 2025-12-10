const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const {imageUploadMiddleware}=require('../../middlewares/user/imageMiddleware');
const profileController = require('../../controllers/user/profileController.js');


router.get('/',isAuthenticated,isVerified,profileController.getProfilePage);
router.get('/section/:sectionName',isAuthenticated, profileController.getProfileSection);
router.post('/change-password',isAuthenticated,profileController.changePassword);
router.post('/update',isAuthenticated,imageUploadMiddleware,profileController.updateProfile);

router.post('/verify-email-update',isAuthenticated,profileController.verifyEmailUpdate);
router.post('/resend-email-otp',isAuthenticated,profileController.resendEmailUpdateOtp);

router.post('/address/add', isAuthenticated, profileController.addAddress);
router.post('/address/edit/:addressId', isAuthenticated, profileController.editAddress);
router.post('/address/remove/:addressId', isAuthenticated, profileController.removeAddress);
router.post('/address/set-default/:addressId',isAuthenticated, profileController.setDefaultAddress);

router.post('/generate-referral',isAuthenticated,profileController.generateReferralCode);


module.exports = router;