const Coupon = require('../../model/coupon.js')

/**
 * @desc    Display all coupons
 * @route   GET /admin/coupons
 */
exports.getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({}).sort({ createdAt: -1 });
        
        const message = req.session.message;
        delete req.session.message;

        res.render('admin/coupons', {
            coupons,
            message,
            current: 'coupons',
             layout:false
        });
    } catch (error) {
        console.error(error);
        req.session.message = { type: 'error', text: 'An error occurred while fetching coupons.' };
        res.redirect('/admin/dashboard');
    }
};

/**
 * @desc    Create a new coupon
 * @route   POST /admin/coupons
 */
exports.createCoupon = async (req, res) => {
    try {
        const { code, ...rest } = req.body;
        const uppercaseCode = code.toUpperCase();

        const existingCoupon = await Coupon.findOne({ code: uppercaseCode });
        if (existingCoupon) {
            req.session.message = { type: 'error', text: 'This coupon code already exists.' };
            return res.redirect('/admin/coupons');
        }

        const newCoupon = new Coupon({ code: uppercaseCode, ...rest });
        await newCoupon.save();
        
        req.session.message = { type: 'success', text: 'Coupon created successfully!' };
        res.redirect('/admin/coupons');

    } catch (error) {
        console.error(error);
        req.session.message = { type: 'error', text: 'Failed to create coupon. Please check inputs.' };
        res.redirect('/admin/coupons');
    }
};

/**
 * @desc    Update an existing coupon
 * @route   PUT /admin/coupons/:id
 */
exports.updateCoupon = async (req, res) => {
    console.log('delete coupon function hitted.............................')
    try {
        const { id } = req.params;
        const { code, ...updateData } = req.body;
        const uppercaseCode = code.toUpperCase();
        
        const existingCoupon = await Coupon.findOne({ code: uppercaseCode, _id: { $ne: id } });
        if (existingCoupon) {
            req.session.message = { type: 'error', text: 'Another coupon with this code already exists.' };
            return res.redirect('/admin/coupons');
        }

        await Coupon.findByIdAndUpdate(id, { code: uppercaseCode, ...updateData });

        req.session.message = { type: 'success', text: 'Coupon updated successfully!' };
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error(error);
        req.session.message = { type: 'error', text: 'Failed to update coupon.' };
        res.redirect('/admin/coupons');
    }
};

/**
 * @desc    Toggle coupon's active status
 * @route   PATCH /admin/coupons/:id/toggle
 */
exports.toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);
        if (coupon) {
            coupon.isActive = !coupon.isActive;
            await coupon.save();
        }
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error(error);
        req.session.message = { type: 'error', text: 'Failed to toggle coupon status.' };
        res.redirect('/admin/coupons');
    }
};

/**
 * @desc    Delete a coupon
 * @route   DELETE /admin/coupons/:id
 */
exports.deleteCoupon = async (req, res) => {
    
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Coupon deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete the coupon.' });
    }
};
