const express = require('express');
const router=express.Router();
const { isAuthenticated, isNotAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');
const orderdetailController = require('../../controllers/admin/orderdetailController.js');
const orderController=require('../../controllers/admin/orderController.js')

router.get('/', isAuthenticated, orderController.renderOrdersPage);
router.get('/api', isAuthenticated, orderController.getOrders);
router.get('/api/:orderId', isAuthenticated, orderdetailController.getSingleOrder);
router.patch('/:orderId/products/:productId/status',isAuthenticated, orderdetailController.updateProductStatus);
router.patch('/:orderId/products/:productId/expected-delivery', isAuthenticated, orderdetailController.updateProductExpectedDelivery);
router.post('/:orderId/request-action',isAuthenticated, orderdetailController.handleOrderRequestAction);
router.post('/:orderId/products/:productId/request-action',isAuthenticated, orderdetailController.handleProductRequestAction);

module.exports = router;