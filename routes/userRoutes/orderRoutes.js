const express = require('express');
const router=express.Router();
const {isNotAuthenticated,isAuthenticated,isVerified}=require('../../middlewares/user/authMiddleware.js');
const orderController = require('../../controllers/user/orderController.js');
const orderdetailController = require('../../controllers/user/orderdetailController.js');


router.get('/search',isAuthenticated,orderController.searchUserOrders)

router.get('/:orderId', isAuthenticated, orderdetailController.getOrderDetail);
router.get('/:orderId/invoice', isAuthenticated,orderdetailController.downloadInvoice);
router.get('/:orderId/items/:itemId/invoice', isAuthenticated, orderdetailController.downloadSingleInvoice);
router.patch('/:orderId/items/:itemId/request-cancellation', isAuthenticated, orderdetailController.requestItemCancellation);
router.patch('/:orderId/request-cancellation', isAuthenticated, orderdetailController.requestEntireOrderCancellation);
router.patch('/:orderId/items/:itemId/request-return', isAuthenticated, orderdetailController.requestItemReturn);
router.patch('/:orderId/request-return', isAuthenticated,orderdetailController.requestEntireOrderReturn);


module.exports = router;