const express = require('express');
const router=express.Router();
const salesController = require('../../controllers/admin/salesController.js');
const { isAuthenticated, isNotAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');

router.get('/',isAuthenticated,salesController.renderSalesPage);
router.get('/download/pdf',isAuthenticated,salesController.downloadPdfReport);
router.get('/download/excel',isAuthenticated,salesController.downloadExcelReport)

module.exports = router;