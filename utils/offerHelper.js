const Offer = require('../model/offer.js');

const findBestOffer = async (productId, categoryId, brandId) => {
    try {
        const now = new Date();

        // Find all active offers for the product, its category, or its brand
        const offers = await Offer.find({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
            $or: [
                { applicable_on_product: productId },
                { applicable_on_category: categoryId },
                { applicable_on_brand: brandId }
            ]
        }).sort({ discountPercentage: -1 }); // Sort by highest discount

        // The first offer in the sorted list is the best one
        return offers.length > 0 ? offers[0] : null;

    } catch (error) {
        console.error("Error finding best offer:", error);
        return null;
    }
};

module.exports = { findBestOffer };