const Coupon = require('../../model/coupon.js')


exports.getAllCoupons = async (req, res) => {
    try {
        const query = {}; 
               const page = parseInt(req.query.page) || 1;
               const limit = 2;
               const skip = (page - 1) * limit;
               const totalCoupons = await Coupon.countDocuments(query);
               const totalPages = Math.ceil(totalCoupons / limit);
               const coupons = await Coupon.find(query).skip(skip).limit(limit);
        const message = req.session.message;
        delete req.session.message;

        res.render('admin/coupons', {
            coupons,
            currentPage:page,
            totalPages,
            message,
            current: 'coupons',
            currentPage:'coupons',
             layout:false
        });
    } catch (error) {
        console.error(error);
        req.session.message = { type: 'error', text: 'An error occurred while fetching coupons.' };
        res.redirect('/admin/dashboard');
    }
};


exports.createCoupon = async (req, res) => {
  try {
    const { code, description, discountType, discountValue, 
            minPurchaseAmount, maxDiscountAmount, usageLimit, expiryDate } = req.body;

    const errors = [];
    if (!code || code.trim().length === 0) {
      errors.push("Coupon code is required.");
    } else if (!/^[A-Za-z0-9]+$/.test(code)) {
      errors.push("Coupon code must contain only letters and numbers (no spaces).");
    } else if (code.trim().length < 3) {
      errors.push("Coupon code must be at least 3 characters long.");
    }
    if (!description || description.trim().length === 0) {
      errors.push("Coupon description is required.");
    } else if (description.length < 5) {
      errors.push("Coupon description should be meaningful (at least 5 characters).");
    }
    const validDiscountTypes = ["fixed_amount", "percentage"];
    if (!discountType || !validDiscountTypes.includes(discountType.toLowerCase())) {
      errors.push("Discount type must be either 'flat' or 'percentage'.");
    }
    if (!discountValue || isNaN(discountValue) || discountValue <= 0) {
      errors.push("Discount value must be a positive number.");
    } else if (discountType === "percentage" && discountValue > 100) {
      errors.push("Discount value cannot exceed 100% for percentage type coupons.");
    }
    if (!minPurchaseAmount || isNaN(minPurchaseAmount) || minPurchaseAmount <= 0) {
      errors.push("Minimum purchase amount must be a positive number.");
    }
    if (discountType === "percentage") {
      if (!maxDiscountAmount || isNaN(maxDiscountAmount) || maxDiscountAmount <= 0) {
        errors.push("Maximum discount amount must be a positive number for percentage coupons.");
      }
    }
    if (!usageLimit || isNaN(usageLimit) || parseInt(usageLimit) <= 0) {
      errors.push("Usage limit must be a positive integer.");
    }
    if (!expiryDate || isNaN(Date.parse(expiryDate))) {
      errors.push("A valid expiry date is required.");
    } else {
      const now = new Date();
      const expiry = new Date(expiryDate);
      if (expiry <= now) {
        errors.push("Expiry date must be a future date.");
      }
    }
    if (errors.length > 0) {
      req.session.message = { type: "error", text: errors.join(" ") };
      return res.redirect("/admin/coupons");
    }
    const uppercaseCode = code.trim().toUpperCase();
    const existingCoupon = await Coupon.findOne({ code: uppercaseCode });
    if (existingCoupon) {
      req.session.message = { type: "error", text: "This coupon code already exists." };
      return res.redirect("/admin/coupons");
    }
    const newCoupon = new Coupon({
      code: uppercaseCode,
      description,
      discountType: discountType.toLowerCase(),
      discountValue: parseFloat(discountValue),
      minPurchaseAmount: parseFloat(minPurchaseAmount),
      maxDiscountAmount: discountType === "percentage" ? parseFloat(maxDiscountAmount) : undefined,
      usageLimit: parseInt(usageLimit),
      expiryDate: new Date(expiryDate),
    });

    await newCoupon.save();
    req.session.message = { type: "success", text: "Coupon created successfully!" };
    res.redirect("/admin/coupons");
  } catch (error) {
    console.error(error);
    req.session.message = { type: "error", text: "Failed to create coupon. Please check inputs." };
    res.redirect("/admin/coupons");
  }
};



exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, ...updateData } = req.body;
    const errors = [];
    let uppercaseCode;
    if (code !== undefined) {
      if (!code || code.trim().length === 0) {
        errors.push("Coupon code cannot be empty.");
      } else if (!/^[A-Za-z0-9]+$/.test(code)) {
        errors.push("Coupon code must contain only letters and numbers (no spaces).");
      } else if (code.trim().length < 3) {
        errors.push("Coupon code must be at least 3 characters long.");
      } else {
        uppercaseCode = code.toUpperCase();
        const existingCoupon = await Coupon.findOne({
          code: uppercaseCode,
          _id: { $ne: id },
        });
        if (existingCoupon) {
          req.session.message = {
            type: "error",
            text: "Another coupon with this code already exists.",
          };
          return res.redirect("/admin/coupons");
        }
      }
    }
    if (updateData.description !== undefined) {
      if (!updateData.description.trim()) {
        errors.push("Coupon description cannot be empty.");
      } else if (updateData.description.trim().length < 5) {
        errors.push("Coupon description should be at least 5 characters long.");
      }
    }

    const validDiscountTypes = ["flat", "percentage"];
    if (updateData.discountType !== undefined) {
      if (!validDiscountTypes.includes(updateData.discountType.toLowerCase())) {
        errors.push("Discount type must be either 'flat' or 'percentage'.");
      }
    }
    if (updateData.discountValue !== undefined) {
      const value = parseFloat(updateData.discountValue);
      if (isNaN(value) || value <= 0) {
        errors.push("Discount value must be a positive number.");
      } else if (updateData.discountType === "percentage" && value > 100) {
        errors.push("For percentage-based coupons, discount value cannot exceed 100.");
      }
    }
    if (updateData.minPurchaseAmount !== undefined) {
      const minAmt = parseFloat(updateData.minPurchaseAmount);
      if (isNaN(minAmt) || minAmt <= 0) {
        errors.push("Minimum purchase amount must be a positive number.");
      }
    }
    if (
      updateData.discountType &&
      updateData.discountType.toLowerCase() === "percentage"
    ) {
      if (updateData.maxDiscountAmount === undefined) {
        errors.push("Maximum discount amount is required for percentage-based coupons.");
      } else {
        const maxAmt = parseFloat(updateData.maxDiscountAmount);
        if (isNaN(maxAmt) || maxAmt <= 0) {
          errors.push("Maximum discount amount must be a positive number.");
        }
      }
    }
    if (updateData.usageLimit !== undefined) {
      const usage = parseInt(updateData.usageLimit, 10);
      if (isNaN(usage) || usage <= 0) {
        errors.push("Usage limit must be a positive integer.");
      }
    }
    if (updateData.expiryDate !== undefined) {
      if (isNaN(Date.parse(updateData.expiryDate))) {
        errors.push("Please provide a valid expiry date.");
      } else {
        const expiry = new Date(updateData.expiryDate);
        const now = new Date();
        if (expiry <= now) {
          errors.push("Expiry date must be set in the future.");
        }
      }
    }
    if (errors.length > 0) {
      req.session.message = { type: "error", text: errors.join(" ") };
      return res.redirect("/admin/coupons");
    }
    const updateFields = {
      ...(uppercaseCode && { code: uppercaseCode }),
      ...updateData,
    };
    await Coupon.findByIdAndUpdate(id, updateFields);
    req.session.message = {
      type: "success",
      text: "Coupon updated successfully!",
    };
    res.redirect("/admin/coupons");
  } catch (error) {
    console.error("Error updating coupon:", error);
    req.session.message = {
      type: "error",
      text: "Failed to update coupon. Please check your inputs.",
    };
    res.redirect("/admin/coupons");
  }
};


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


exports.deleteCoupon = async (req, res) => {
    
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Coupon deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete the coupon.' });
    }
};
