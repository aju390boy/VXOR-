
const express = require('express');
const router=express.Router();
const { isAuthenticated, isNotAuthenticated } = require('../../middlewares/admin/viewsMiddleware.js');
const offerController = require('../../controllers/admin/offerController.js');


router.get('/',isAuthenticated, offerController.getAllOffers);
router.post('/',isAuthenticated, offerController.createOffer);
router.put('/:id', isAuthenticated,offerController.updateOffer);
router.patch('/:id/toggle',isAuthenticated, offerController.toggleOfferStatus);
router.delete('/:id',isAuthenticated, offerController.deleteOffer);


module.exports = router;