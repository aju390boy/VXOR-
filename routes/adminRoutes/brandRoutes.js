const express = require('express');
const router=express.Router();
const { isAuthenticated, isNotAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');
const brandController=require('../../controllers/admin/brandController.js')

router.get('/', isAuthenticated,brandController.getBrands);
router.post('/add', isAuthenticated,brandController.uploadBrandImage.single('image'), brandController.addBrand);
router.post('/toggle/:id',isAuthenticated, brandController.toggleBrandStatus);
router.post('/edit/:id',isAuthenticated, brandController.uploadBrandImage.single('image'), brandController.editBrand);
router.post('/delete/:id',isAuthenticated, brandController.deleteBrand);


module.exports = router;