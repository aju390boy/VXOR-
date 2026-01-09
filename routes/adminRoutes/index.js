const express = require('express');
const router=express.Router();

const authRoutes = require('./authRoutes.js');
const productRoutes = require('./productRoutes.js');
const brandRoutes = require('./brandRoutes.js');
const categoryRoutes = require('./categoryRoutes.js');
const dashboardRoutes = require('./dashboardRoutes.js');
const offerRoutes = require('./offerRoutes.js');
const couponRoutes = require('./couponRoutes.js');
const salesRoutes = require('./salesRoutes.js');
const orderRoutes = require('./orderRoutes.js');
const customerRoutes = require('./customerRoutes.js');
const logoutRoutes = require('./logoutRoutes.js');
const bannerRoutes = require('./bannerRoutes.js');

router.use('/coupons',couponRoutes);
router.use('/offers',offerRoutes);
router.use('/sales',salesRoutes);
router.use('/category',categoryRoutes);
router.use('/brand',brandRoutes);
router.use('/login',authRoutes);
router.use('/dashboard',dashboardRoutes);
router.use('/logout',logoutRoutes);
router.use('/orders',orderRoutes);
router.use('/customers',customerRoutes);
router.use('/products',productRoutes);
router.use('/banner',bannerRoutes);

module.exports = router;