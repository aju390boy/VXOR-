const express = require('express');
const router=express.Router();
const { isAuthenticated, isNotAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');
const customerController=require('../../controllers/admin/customerController.js')


router.get('/', isAuthenticated, customerController.getCustomers);
router.post('/:id/block', isAuthenticated, customerController.blockCustomer);
router.post('/:id/unblock',  isAuthenticated,customerController.unblockCustomer);
router.get('/search',isAuthenticated,customerController.getCustomersAjax);


module.exports = router;