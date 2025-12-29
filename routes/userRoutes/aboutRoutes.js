const express = require('express');
const router=express.Router();
const aboutAndContactController = require('../../controllers/user/aboutAndContactController.js');
const { isAuthenticated } = require('../../middlewares/user/authMiddleware.js');

router.get('/',aboutAndContactController.getAbout);

module.exports = router;
