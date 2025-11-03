const express = require('express');
const router = express.Router();

const logoutController = require('../../controllers/user/logoutController.js');

router.get('/', logoutController.logoutUser);


module.exports = router;