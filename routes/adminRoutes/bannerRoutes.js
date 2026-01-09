const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');
const bannerController = require('../../controllers/admin/bannerController.js');

router.get('/', isAuthenticated, bannerController.getBannerPage);

router.post('/add', 
    isAuthenticated, 
    bannerController.upload.array('images'),
    bannerController.addBanner
);
router.post('/update', 
    isAuthenticated, 
    bannerController.upload.array('images'), 
    bannerController.updateBanner
);
// Add this line to your router
// Route: /admin/banner/delete/:id
router.delete('/delete/:id', isAuthenticated, bannerController.deleteBanner);

module.exports = router;