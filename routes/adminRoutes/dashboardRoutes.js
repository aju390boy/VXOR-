const express = require('express');
const router=express.Router();
const { isAuthenticated, isNotAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');
const dashboardController=require('../../controllers/admin/dashboardController.js')


router.get('/',isAuthenticated, dashboardController.getDashboard);


module.exports = router;