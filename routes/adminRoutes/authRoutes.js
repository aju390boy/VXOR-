const express = require('express');
const router=express.Router();
const { isAuthenticated, isNotAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');
const authController=require('../../controllers/admin/authController.js')



router.route('/')
.get( isNotAuthenticated,authController.getAdminLoginPage)
.post(isNotAuthenticated, authController.postAdminLogin);




module.exports = router;