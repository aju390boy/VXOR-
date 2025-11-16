const { use } = require("passport");
const User = require("../../model/user.js");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const Address = require("../../model/address.js");
const Wishlist = require('../../model/wishlist.js');
const Wallet = require('../../model/wallet.js');
const Cart = require('../../model/cart.js');
const fs = require("fs").promises;
const mongoose = require("mongoose");
const Order = require("../../model/order.js");
const { log } = require("console");
const Otp = require("../../model/otp.js");
const { sendMail } = require("../../utils/otpMailer1.js");
const crypto = require("crypto");
const {findBestOffer} = require('../../utils/offerHelper.js');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/profileImages/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = file.originalname.split(".").pop();
    cb(null, file.fieldname + "-" + uniqueSuffix + "." + fileExtension);
  },
});

/////////////////////////////////////
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

/////////////////////////////
exports.upload = multer({
  storage: storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 1024 * 1024 * 5 },
});

exports.getProfilePage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      console.error("User not found in DB for ID:", req.user._id);
      return res
        .status(404)
        .render("error", { message: "User profile not found." });
    }

    const addresses = await Address.find({ user_id: req.user._id }).lean();

    const defaultAddress = addresses.find((address) => address.isDefault);

    res.render("user/profile/profileMain", {
      title: "My Profile",
      user: user,
      addresses: addresses || [],
      defaultAddress: defaultAddress,
    });
  } catch (error) {
    console.error("Error fetching profile page:", error);
    res
      .status(500)
      .render("error", { message: "Failed to load profile page." });
  }
};

exports.getProfileSection = async (req, res) => {
  const { sectionName } = req.params;
  const user = req.user;
  console.log(`user details : ${user}`)
  try {
    let data = { user: null };
    let templatePath = "";

    if (user && user._id) {
      data.user = await User.findById(user._id).lean();
      if (!data.user) {
        console.error("User not found for dynamic section:", user._id);
        return res
          .status(404)
          .send(
            '<p class="text-red-400">User data not available for this section.</p>'
          );
      }
    } else {
      console.error(
        "User not authenticated or user ID missing for dynamic section."
      );
      return res
        .status(401)
        .send(
          '<p class="text-red-400">Authentication required for this section.</p>'
        );
    }

    switch (sectionName) {
      case "profile":
        const addressesForProfile = await Address.find({
          user_id: user._id,
        }).lean();
        data.addresses = addressesForProfile;

        data.defaultAddress = addressesForProfile.find(
          (address) => address.isDefault
        );
        templatePath = "user/profile/partials/_profileDetails";
        break;
      
        case "wishlist":
  const pageWishlist = parseInt(req.query.page) || 1;
  const limitWishlist = parseInt(req.query.limit) || 5;
  const skipWishlist = (pageWishlist - 1) * limitWishlist;
  const cart = await Cart.findOne({ userId: user._id }).select('items.productId').lean();
  const cartProductIds = new Set(cart ? cart.items.map(item => item.productId.toString()) : []);
  const wishlist = await Wishlist.findOne({ user_id: user._id })
    .populate({
      path: 'products.product_id',
      model: 'Product',
      populate: [{ path: 'category_id', select: 'name' }, { path: 'brand_id', select: 'name' }]
    })
    .lean();

  let filteredProducts = [];
  if (wishlist && wishlist.products.length > 0) {
    filteredProducts = wishlist.products.filter(wishlistItem => {
      const product = wishlistItem.product_id;
      if (!product) return false;
      return !cartProductIds.has(product._id.toString());
    });
  }
  const totalWishlistCount = filteredProducts.length;
  const pagedProducts = filteredProducts.slice(skipWishlist, skipWishlist + limitWishlist);
  const processedWishlistItems = await Promise.all(
    pagedProducts.map(async (item) => {
      const product = item.product_id;
      let displayImageUrl="/uploads/products/placeholder.png";
      if (product.isDeleted || !product.isListed) return null;
      let totalStock = 0;
          product.colorVariants.forEach(color => {
          color.variants.forEach(size => {
          totalStock += size.stock;
       });
     });
      const bestOffer = await findBestOffer(product._id, product.category_id?._id, product.brand_id?._id);
      product?.colorVariants?.forEach((colorVariant)=>{
       if(colorVariant.images && colorVariant.images.length>0){
        let firstImage=colorVariant.images[0];
        displayImageUrl=firstImage.startsWith('http')?firstImage : `/uploads/products/${firstImage}`;
      }
      });
      let discountedPrice = null;
      if (bestOffer && product.min_price > 0) {
        discountedPrice = product.min_price * (1 - bestOffer.discountPercentage / 100);
      }
      return {
        ...product,
        totalStock:totalStock,
        bestOffer,
        display_image_url: displayImageUrl,
        discounted_price: discountedPrice
      };
    })
  );
  data.wishlistItems = processedWishlistItems.filter(item => item !== null);
  data.pagination = {
    totalPages: Math.ceil(totalWishlistCount / limitWishlist),
    currentPage: pageWishlist,
    limit: limitWishlist,
  };

  templatePath = "user/profile/partials/_wishlist";
  break;

        case "wallet":
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 5;
  const skip = (page - 1) * limit;

  let wallet = await Wallet.findOne({ user_id: user._id }).lean();
  if (!wallet) {
    wallet = { balance: 0, transactions: [] };
  }
  const totalTxns = wallet.transactions.length;
  const pagedTransactions = wallet.transactions
    .slice() 
    .reverse() 
    .slice(skip, skip + limit);
  const totalPages = Math.ceil(totalTxns / limit);
  data.wallet = {
    ...wallet,
    transactions: pagedTransactions,
    pagination: { totalPages, currentPage: page, limit },
  };
  templatePath = "user/profile/partials/_wallet";
  break;
      case "orders":
  const pageOrders = parseInt(req.query.page) || 1;
  const limitOrders = parseInt(req.query.limit) || 10;
  const skipOrders = (pageOrders - 1) * limitOrders;
  const totalOrdersCount = await Order.countDocuments({ user_id: user._id });
  const orders = await Order.find({ user_id: user._id })
    .select("order_id total_amount payment_status createdAt products")
    .sort({ createdAt: -1 })
    .skip(skipOrders)
    .limit(limitOrders)
    .populate({
      path: "products.product_id",
      select: "title colorVariants",
    })
    .lean();

  orders.forEach(order => {
    const firstProduct = order.products?.[0]?.product_id;
    console.log(`image :${order.display_image_url}`);
   order.display_image_url =
  (firstProduct && Array.isArray(firstProduct.colorVariants) 
    && firstProduct.colorVariants.length > 0 
    && firstProduct.colorVariants[0].images 
    && firstProduct.colorVariants[0].images.length > 0)
  ? (firstProduct.colorVariants[0].images[0].startsWith('http')
      ? firstProduct.colorVariants[0].images[0]
      : `/uploads/products/${firstProduct.colorVariants[0].images[0]}`
    )
  : '/images/placeholder.png';


    console.log(`image 2 : ${order.display_image_url}`)
  });
  console.log(`count : ${ Math.ceil(totalOrdersCount / limitOrders)}`);
  console.log(`current pages : ${pageOrders}`);
  console.log(`limit :${limitOrders}`);
  data.orders = orders,
  pagination = {
  totalPages: Math.ceil(totalOrdersCount / limitOrders), 
  currentPage: pageOrders,
  limit: limitOrders,
};

  templatePath = "user/profile/partials/_orderList";
  break;

      case "address":
        const addresses = await Address.find({ user_id: user._id }).lean();
        data.addresses = addresses;
        data.defaultAddress = addresses.find((address) => address.isDefault);
        templatePath = "user/profile/partials/_address";
        break;
      case "change-password":
        templatePath = "user/profile/partials/_changePasswordForm";
        data = {};
        break;
      default:
        return res
          .status(404)
          .send('<p class="text-red-400">Requested section not found.</p>');
    }
    

    res.render(templatePath, { ...data, layout: false }, (err, html) => {
      if (err) {
        console.error(`Error rendering partial ${templatePath}:`, err);
        return res
          .status(500)
          .send('<p class="text-red-400">Error rendering section content.</p>');
      }
      res.send(html);
    });
  } catch (error) {
    console.error(`Error fetching data for section ${sectionName}:`, error);
    res
      .status(500)
      .send(
        '<p class="text-red-400">Failed to load section data due to server error.</p>'
      );
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    const { firstname, lastname, email, mobile, originalEmail, addressId } =
      req.body;
    const errors = {};
    if (!firstname || firstname.trim() === "") {
      errors.firstname = "First name is required.";
    } else if (firstname.trim().length < 2) {
      errors.firstname = "First name must be at least 2 characters long.";
    }
    if (!lastname || lastname.trim() === "") {
      errors.lastname = "Last name is required.";
    } else if (lastname.trim().length < 2) {
      errors.lastname = "Last name must be at least 2 characters long.";
    }

    if (!email || email.trim() === "") {
      errors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (mobile && mobile.trim() !== "" && !/^\d{10}$/.test(mobile)) {
      errors.mobile = "Mobile number must be 10 digits long.";
    }

    if (addressId && !mongoose.Types.ObjectId.isValid(addressId)) {
      errors.addressId = "Invalid address ID provided.";
    }

    if (Object.keys(errors).length > 0) {
      if (req.file) {
        const newImagePath = path.join(
          __dirname,
          "..",
          "..",
          "public",
          req.file.path
        );
        await fs
          .unlink(newImagePath)
          .catch((err) =>
            console.error(
              "Error deleting new file after validation error:",
              err.message
            )
          );
      }
      return res.status(400).json({ message: "Validation failed.", errors });
    }

    ///////////////email section////////////
    const newEmail = email.trim().toLowerCase();
    if (newEmail !== user.email) {
      const emailExists = await User.findOne({ email: newEmail });
      if (emailExists) {
        if (req.file) await deleteFile(req.file.path, true);
        return res
          .status(400)
          .json({ message: "This email address is already registered." });
      }
      const otp = crypto.randomInt(100000, 999999).toString();
      console.log(`original otp : ${otp}`);
      await Otp.deleteMany({ email: newEmail, context: "email-update" });
      await new Otp({
        email: newEmail,
        otp: otp,
        context: "email-update",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }).save();
      await sendMail(newEmail, otp);
      return res.status(200).json({
        otpSent: true,
        newEmail: newEmail,
        message: `An OTP has been sent to ${newEmail} for verification.`,
      });
    } else {
      let updateData = {
        firstname,
        lastname,
        email,
        mobile: mobile || null,
      };
      if (addressId) {
        await Address.findOneAndUpdate(
          { user_id: userId, isDefault: true },
          { $set: { isDefault: false } }
        );
        await Address.findByIdAndUpdate(
          addressId,
          { $set: { isDefault: true } },
          { new: true }
        );
      }
      if (req.file) {
        if (
          user.profileImage &&
          user.profileImage !== "/images/default-profile.png"
        ) {
          const oldImagePath = path.join(
            __dirname,
            "..",
            "..",
            "public",
            user.profileImage
          );
          try {
            await fs.unlink(oldImagePath);
          } catch (err) {
            console.error("Error deleting old profile image:", err.message);
          }
        }
        updateData.profileImage = `/uploads/profileImages/${req.file.filename}`;
      }
      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      });
      if (!updatedUser) {
        return res
          .status(404)
          .json({ message: "User not found after update." });
      }
      res
        .status(200)
        .json({ message: "Profile updated successfully!", user: updatedUser });
    }
  } catch (err) {
    if (err.name === "ValidationError") {
      const errors = {};
      for (const field in err.errors) {
        errors[field] = err.errors[field].message;
      }
      return res.status(400).json({ message: "Validation failed.", errors });
    }
    console.error("Error updating user profile:", err);
    res.status(500).json({ message: "Internal server error." });
  }
};

/////helper function////
const deleteFile = async (filePath, isFullPath = false) => {
  try {
    const fullPath = isFullPath
      ? filePath
      : path.join(__dirname, "..", "..", "public", filePath);
    await fs.unlink(fullPath);
  } catch (err) {
    console.error(
      `Failed to delete file or file not found: ${filePath}`,
      err.message
    );
  }
};

///////////////varify email///////////////
exports.verifyEmailUpdate = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otp, newEmail } = req.body;
    if (!otp || !newEmail) {
      return res
        .status(400)
        .json({ message: "OTP and new email are required." });
    }
    const foundOtp = await Otp.findOne({
      email: newEmail.toLowerCase(),
      otp: otp,
      context: "email-update",
    });
    if (!foundOtp) {
      return res
        .status(400)
        .json({ message: "Invalid or expired OTP. Please try again." });
    }
    const user = await User.findById(userId);
    user.email = newEmail.toLowerCase();
    await user.save();
    await Otp.deleteOne({ _id: foundOtp._id });
    res.status(200).json({ message: "Email address updated successfully!" });
  } catch (error) {
    console.error("Error verifying email update:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};

///////////Resend otp//////////
exports.resendEmailUpdateOtp = async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail) {
      return res
        .status(400)
        .json({ message: "New email address is required." });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    console.log(`resend otp : ${otp}`);
    await Otp.deleteMany({ email: newEmail, context: "email-update" });
    await new Otp({
      email: newEmail,
      otp: otp,
      context: "email-update",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    }).save();
    try {
      await sendMail(newEmail, otp);
    } catch (emailError) {
      console.error("Mail sending failed in resend OTP:", emailError);
      return res
        .status(500)
        .json({ message: "Failed to send OTP email. Please try again." });
    }
    res
      .status(200)
      .json({ message: `A new OTP has been sent to ${newEmail}.` });
  } catch (error) {
    console.error("Error resending email update OTP:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
};

// address as default ///
exports.setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user._id;

    const address = await Address.findOne({ _id: addressId, user_id: userId });
    if (!address) {
      return res
        .status(404)
        .json({ message: "Address not found or unauthorized." });
    }
    await Address.updateMany(
      { user_id: userId, _id: { $ne: addressId } },
      { $set: { isDefault: false } }
    );
    const updatedAddress = await Address.findByIdAndUpdate(
      addressId,
      { $set: { isDefault: true } },
      { new: true, runValidators: true }
    );
    if (!updatedAddress) {
      return res
        .status(404)
        .json({ message: "Address not found during update." });
    }
    res.status(200).json({
      message: "Default address updated successfully!",
      address: updatedAddress,
    });
  } catch (error) {
    console.error("Error setting default address:", error);
    res
      .status(500)
      .json({ message: "Failed to set default address. Please try again." });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors = {};

  if (!currentPassword || !newPassword || !confirmPassword) {
    errors.general = "All password fields are required.";
    return res
      .status(400)
      .json({ success: false, message: errors.general, errors });
  }

  if (newPassword !== confirmPassword) {
    errors.confirmPassword = "New password and confirm password do not match.";
  }
  if (newPassword.length < 4) {
    errors.newPassword = "New password must be at least 4 characters long.";
  }
  if (!/[A-Z]/.test(newPassword)) {
    errors.newPassword = errors.newPassword
      ? errors.newPassword + " And must contain at least one uppercase letter."
      : "New password must contain at least one uppercase letter.";
  }
  if (!/[a-z]/.test(newPassword)) {
    errors.newPassword = errors.newPassword
      ? errors.newPassword + " And must contain at least one lowercase letter."
      : "New password must contain at least one lowercase letter.";
  }
  if (!/[0-9]/.test(newPassword)) {
    errors.newPassword = errors.newPassword
      ? errors.newPassword + " And must contain at least one number."
      : "New password must contain at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(newPassword)) {
    errors.newPassword = errors.newPassword
      ? errors.newPassword + " And must contain at least one special character."
      : "New password must contain at least one special character.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed. Please check your inputs.",
      errors,
    });
  }

  try {
    const userId = req.session.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      errors.currentPassword = "Incorrect current password.";
      return res
        .status(400)
        .json({ success: false, message: errors.currentPassword, errors });
    }

    const isNewSameAsCurrent = await bcrypt.compare(newPassword, user.password);
    if (isNewSameAsCurrent) {
      errors.newPassword =
        "New password cannot be the same as your current password.";
      return res
        .status(400)
        .json({ success: false, message: errors.newPassword, errors });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Could not update password.",
    });
  }
};

///add adress///
exports.addAddress = async (req, res) => {
  try {
    const name = req.body.name ? req.body.name.trim() : "";
    const mobile = req.body.mobile ? req.body.mobile.trim() : "";
    const address1 = req.body.address1 ? req.body.address1.trim() : "";
    const address2 = req.body.address2 ? req.body.address2.trim() : "";
    const city = req.body.city ? req.body.city.trim() : "";
    const state = req.body.state ? req.body.state.trim() : "";
    const pincode = req.body.pincode ? req.body.pincode.trim() : "";
    const country = req.body.country ? req.body.country.trim() : "India";
    const validationErrors = [];
    if (!name) {
      validationErrors.push("Name is required.");
    } else if (name.length < 2) {
      validationErrors.push("Name must be at least 2 characters long.");
    }
    if (!mobile) {
      validationErrors.push("Mobile number is required.");
    } else if (!/^\d{10}$/.test(mobile)) {
      validationErrors.push("Mobile number must be exactly 10 digits.");
    }
    if (!pincode) {
      validationErrors.push("Pincode is required.");
    } else if (!/^\d{6}$/.test(pincode)) {
      validationErrors.push("Pincode must be exactly 6 digits.");
    }
    if (!address1) validationErrors.push("Address Line 1 is required.");
    if (!city) validationErrors.push("City is required.");
    if (!state) validationErrors.push("State is required.");
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Validation failed. Please check your inputs.",
        errors: validationErrors,
      });
    }
    const newAddress = new Address({
      user_id: req.user._id,
      name,
      mobile,
      address1,
      address2,
      city,
      state,
      pincode,
      country,
    });
    await newAddress.save();
    const user = await User.findById(req.user._id);
    if (user && !user.defaultAddress) {
      user.defaultAddress = newAddress._id;
      await user.save();
    }
    res.status(201).json({
      message: "Address added successfully!",
      address: newAddress,
    });
  } catch (error) {
    console.error("Error adding address:", error);
    res
      .status(500)
      .json({ message: "Failed to add address. Please try again." });
  }
};
///edit address///
exports.editAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const name = req.body.name ? req.body.name.trim() : undefined;
    const mobile = req.body.mobile ? req.body.mobile.trim() : undefined;
    const address1 = req.body.address1 ? req.body.address1.trim() : undefined;
    const address2 = req.body.address2 ? req.body.address2.trim() : undefined;
    const city = req.body.city ? req.body.city.trim() : undefined;
    const state = req.body.state ? req.body.state.trim() : undefined;
    const pincode = req.body.pincode ? req.body.pincode.trim() : undefined;
    const country = req.body.country ? req.body.country.trim() : undefined;
    const validationErrors = [];
    if (name !== undefined) {
      if (name === "") validationErrors.push("Name cannot be empty.");
      else if (name.length < 2)
        validationErrors.push("Name must be at least 2 characters long.");
    }
    if (mobile !== undefined) {
      if (mobile === "")
        validationErrors.push("Mobile number cannot be empty.");
      else if (!/^\d{10}$/.test(mobile))
        validationErrors.push("Mobile number must be exactly 10 digits.");
    }
    if (pincode !== undefined) {
      if (pincode === "") validationErrors.push("Pincode cannot be empty.");
      else if (!/^\d{6}$/.test(pincode))
        validationErrors.push("Pincode must be exactly 6 digits.");
    }
    if (address1 === "")
      validationErrors.push("Address Line 1 cannot be empty.");
    if (city === "") validationErrors.push("City cannot be empty.");
    if (state === "") validationErrors.push("State cannot be empty.");
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Validation failed. Please check your inputs.",
        errors: validationErrors,
      });
    }
    const updatedFields = {};
    if (name !== undefined) updatedFields.name = name;
    if (mobile !== undefined) updatedFields.mobile = mobile;
    if (address1 !== undefined) updatedFields.address1 = address1;
    if (address2 !== undefined) updatedFields.address2 = address2;
    if (city !== undefined) updatedFields.city = city;
    if (state !== undefined) updatedFields.state = state;
    if (pincode !== undefined) updatedFields.pincode = pincode;
    if (country !== undefined) updatedFields.country = country;
    if (Object.keys(updatedFields).length === 0) {
      return res.status(400).json({ message: "No fields to update." });
    }
    const updatedAddress = await Address.findOneAndUpdate(
      { _id: addressId, user_id: req.user._id },
      { $set: updatedFields },
      { new: true, runValidators: true }
    );
    if (!updatedAddress) {
      return res
        .status(404)
        .json({
          message: "Address not found or you are not authorized to edit it.",
        });
    }
    res.status(200).json({
      message: "Address updated successfully!",
      address: updatedAddress,
    });
  } catch (error) {
    console.error("Error updating address:", error);
    res
      .status(500)
      .json({ message: "Failed to update address. Please try again." });
  }
};

////remove address////
exports.removeAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const deletedAddress = await Address.findOneAndDelete({
      _id: addressId,
      user_id: req.user._id,
    });
    if (!deletedAddress) {
      return res
        .status(404)
        .json({ message: "Address not found or unauthorized." });
    }
    const user = await User.findById(req.user._id);
    if (
      user &&
      user.defaultAddress &&
      user.defaultAddress.toString() === addressId
    ) {
      user.defaultAddress = undefined;
      await user.save();
    }
    res.status(200).json({ message: "Address removed successfully!" });
  } catch (error) {
    console.error("Error removing address:", error);
    res
      .status(500)
      .json({ message: "Failed to remove address. Please try again." });
  }
};
