const express = require('express');
const router=express.Router();
const { isAuthenticated, isNotAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');
const authController=require('../../controllers/admin/authController.js')


router.post('/', authController.logoutUser);


module.exports = router;