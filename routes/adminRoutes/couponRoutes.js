const express = require('express');
const router=express.Router();
const { isAuthenticated, isNotAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');
const couponController = require('../../controllers/admin/couponController.js');


router.get('/', isAuthenticated,couponController.getAllCoupons);
router.post('/', isAuthenticated,couponController.createCoupon);
router.put('/:id',isAuthenticated, couponController.updateCoupon);
router.patch('/:id/toggle', isAuthenticated,couponController.toggleCouponStatus);
router.delete('/:id', isAuthenticated,couponController.deleteCoupon);


module.exports = router;