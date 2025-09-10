const Offer = require('../../model/offer.js');
const Product = require('../../model/product.js');
const Brand = require('../../model/brand.js');
const Category = require('../../model/category.js');

/**
 * @desc    Display all offers
 * @route   GET /admin/offers
 */
exports.getAllOffers = async (req, res) => {
    try {
        const offers = await Offer.find({}).sort({ createdAt: -1 });
        const categories = await Category.find({ isListed: true });
        const products = await Product.find({ isDeleted: false });
        const brands = await Brand.find({ isListed: true });
        // 1. Retrieve the message from the session
        const message = req.session.message;
        // 2. Clear the message from the session
        delete req.session.message; 

        res.render('admin/offers', {
            offers,
            categories,
            products,
            brands,
            message, // 3. Pass the retrieved message to the template
            current: 'offers',
            layout:false
        });
    } catch (error) {
        console.error(error);
        // On error, we still set a session message for the redirect
        req.session.message = { type: 'error', text: 'An error occurred while fetching offers.' };
        res.redirect('/admin/dashboard');
    }
};

/**
 * @desc    Create a new offer
 * @route   POST /admin/offers
 */
exports.createOffer = async (req, res) => {
    try {
        const { 
            name, 
            discountPercentage, 
            startDate, 
            endDate,
            applicable_on_category,
            applicable_on_product,
            applicable_on_brand
        } = req.body;

        // --- MANUAL VALIDATION BLOCK ---
        const errors = [];
        
        // 1. Name validation (Required + Unique)
        if (!name || name.trim() === '') {
            errors.push('Offer name is required.');
        } else {
            const existingOffer = await Offer.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
            if (existingOffer) {
                errors.push('An offer with this name already exists.');
            }
        }
        
        // 2. Discount Percentage validation (Number between 1-90)
        const discount = Number(discountPercentage);
        if (isNaN(discount) || discount < 1 || discount > 90) {
            errors.push('Discount must be a number between 1 and 90.');
        }

        // 3. Date validation (Valid dates + End date is after start date)
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || !startDate) {
            errors.push('A valid start date is required.');
        }
        if (isNaN(end.getTime()) || !endDate) {
            errors.push('A valid end date is required.');
        }
        if (start >= end) {
            errors.push('End date must be after the start date.');
        }

        // --- END OF VALIDATION ---

        // If there are any errors, redirect back with the messages
        if (errors.length > 0) {
            req.session.message = { type: 'error', text: errors.join(' ') };
            return res.redirect('/admin/offers');
        }

        const newOffer = new Offer({ 
            name, discountPercentage, startDate, endDate,
            applicable_on_category: applicable_on_category || [],
            applicable_on_product: applicable_on_product || [],
            applicable_on_brand: applicable_on_brand || []
        });

        await newOffer.save();
        req.session.message = { type: 'success', text: 'Offer created successfully!' };
        res.redirect('/admin/offers');

    } catch (error) {
        console.error(error);
        req.session.message = { type: 'error', text: 'An unexpected error occurred.' };
        res.redirect('/admin/offers');
    }
};

/**
 * @desc    Update an existing offer
 * @route   PUT /admin/offers/:id
 */
exports.updateOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, 
            discountPercentage, 
            startDate, 
            endDate,
            applicable_on_category,
            applicable_on_product,
            applicable_on_brand
        } = req.body;

        // --- MANUAL VALIDATION BLOCK ---
        const errors = [];

        // 1. Name validation (Required + Unique, excluding the current document)
        if (!name || name.trim() === '') {
            errors.push('Offer name is required.');
        } else {
            const existingOffer = await Offer.findOne({ 
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
                _id: { $ne: id } // Exclude the document we are currently editing
            });
            if (existingOffer) {
                errors.push('Another offer with this name already exists.');
            }
        }
        
        // 2. Discount Percentage validation
        const discount = Number(discountPercentage);
        if (isNaN(discount) || discount < 1 || discount > 90) {
            errors.push('Discount must be a number between 1 and 90.');
        }

        // 3. Date validation
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || !startDate) {
            errors.push('A valid start date is required.');
        }
        if (isNaN(end.getTime()) || !endDate) {
            errors.push('A valid end date is required.');
        }
        if (start >= end) {
            errors.push('End date must be after the start date.');
        }

        // --- END OF VALIDATION ---
        
        if (errors.length > 0) {
            req.session.message = { type: 'error', text: errors.join(' ') };
            return res.redirect('/admin/offers');
        }

        const updateData = {
            name, discountPercentage, startDate, endDate,
            applicable_on_category: applicable_on_category || [],
            applicable_on_product: applicable_on_product || [],
            applicable_on_brand: applicable_on_brand || []
        };

        await Offer.findByIdAndUpdate(id, updateData);
        req.session.message = { type: 'success', text: 'Offer updated successfully!' };
        res.redirect('/admin/offers');

    } catch (error) {
        console.error(error);
        req.session.message = { type: 'error', text: 'An unexpected error occurred.' };
        res.redirect('/admin/offers');
    }
};
/**
 * @desc    Toggle offer's active status
 * @route   PATCH /admin/offers/:id/toggle
 */
exports.toggleOfferStatus = async (req, res) => {
    console.log('toggle offer status funcion triggered........')
    try {
        const { id } = req.params;
        const offer = await Offer.findById(id);
        if (offer) {
            offer.isActive = !offer.isActive;
            await offer.save();
        }
        res.redirect('/admin/offers');
    } catch (error) {
        console.error(error);
        req.session.message = { type: 'error', text: 'Failed to toggle offer status.' };
        res.redirect('/admin/offers');
    }
};

/**
 * @desc    Delete an offer
 * @route   DELETE /admin/offers/:id
 */
exports.deleteOffer = async (req, res) => {
    try {
        await Offer.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Offer deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete the offer.' });
    }
};
