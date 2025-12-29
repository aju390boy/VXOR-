const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const orderController = require('../../controllers/user/orderController.js');
const orderdetailController = require('../../controllers/user/orderdetailController.js');


router.get('/search',isAuthenticated,orderController.searchUserOrders)

// Route example:
router.get('/:orderId/items/:itemId', isAuthenticated, isVerified,orderdetailController.getOrderDetail);
router.get('/:orderId/invoice', isAuthenticated,isVerified,orderdetailController.downloadInvoice);
router.get('/:orderId/items/:itemId/invoice', isAuthenticated, isVerified,orderdetailController.downloadSingleInvoice);
router.patch('/:orderId/items/:itemId/request-cancellation', isAuthenticated, isVerified,orderdetailController.requestItemCancellation);
router.patch('/:orderId/request-cancellation', isAuthenticated,isVerified, orderdetailController.requestEntireOrderCancellation);
router.patch('/:orderId/items/:itemId/request-return', isAuthenticated,isVerified, orderdetailController.requestItemReturn);
router.patch('/:orderId/request-return', isAuthenticated,isVerified,orderdetailController.requestEntireOrderReturn);
// router.patch('/:orderId,retry-payment', isAuthenticated, orderController.retrPayment);


module.exports = router;