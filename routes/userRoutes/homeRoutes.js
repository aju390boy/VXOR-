const express = require('express');
const router=express.Router();
const userController = require('../../controllers/user/userController.js');


router.route('/')
  .get(userController.getHome);

  
  module.exports = router;