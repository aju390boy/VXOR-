const Offer = require('../../model/offer.js');
const Product = require('../../model/product.js');
const Brand = require('../../model/brand.js');
const Category = require('../../model/category.js');


exports.getAllOffers = async (req, res) => {
    try {
        const query = {}; 
        const page = parseInt(req.query.page) || 1;
        const limit = 2;
        const skip = (page - 1) * limit;
       
        const totalOffers = await Offer.countDocuments(query);
        const totalPages = Math.ceil(totalOffers / limit);
        const offers = await Offer.find(query).skip(skip).limit(limit);
        const categories = await Category.find({ isListed: true });
        const products = await Product.find({ isDeleted: false });
        const brands = await Brand.find({ isListed: true });
        const message = req.session.message;
        delete req.session.message; 
        res.render('admin/offers', {
            offers,
            categories,
            products,
            brands,
            currentPage:page,
            totalPages,
            message,
            current: 'offers',
            layout:false
        });
    } catch (error) {
        console.error(error);
        req.session.message = { type: 'error', text: 'An error occurred while fetching offers.' };
        res.redirect('/admin/dashboard');
    }
};


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
        if (!name || name.trim() === '') {
            errors.push('Offer name is required.');
        } else {
            const existingOffer = await Offer.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
            if (existingOffer) {
                errors.push('An offer with this name already exists.');
            }
        }
        const discount = Number(discountPercentage);
        if (isNaN(discount) || discount < 1 || discount > 90) {
            errors.push('Discount must be a number between 1 and 90.');
        }
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
        const errors = [];
        if (!name || name.trim() === '') {
            errors.push('Offer name is required.');
        } else {
            const existingOffer = await Offer.findOne({ 
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
                _id: { $ne: id } 
            });
            if (existingOffer) {
                errors.push('Another offer with this name already exists.');
            }
        }
        const discount = Number(discountPercentage);
        if (isNaN(discount) || discount < 1 || discount > 90) {
            errors.push('Discount must be a number between 1 and 90.');
        }
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



exports.deleteOffer = async (req, res) => {
    try {
        await Offer.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Offer deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete the offer.' });
    }
};
