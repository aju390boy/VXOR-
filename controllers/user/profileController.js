
const { use } = require('passport');
const User = require('../../model/user.js'); 
const bcrypt = require('bcrypt')
const multer = require('multer');
const path=require('path');
const Address=require('../../model/address.js');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const Order = require('../../model/order.js');
const { log } = require('console');


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/profileImages/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = file.originalname.split('.').pop();
        cb(null, file.fieldname + '-' + uniqueSuffix + '.' + fileExtension);
    }
});
exports.upload = multer({ storage: storage });


exports.getProfilePage = async (req, res) => {
    try {
        // Fetch the user data
        const user = await User.findById(req.user._id).lean();

        if (!user) {
            console.error("User not found in DB for ID:", req.user._id);
            return res.status(404).render('error', { message: 'User profile not found.' });
        }

        // Fetch all addresses associated with the user
        const addresses = await Address.find({ user_id: req.user._id }).lean();
        
        // Find the default address from the list of addresses using the isDefault flag.
        // This replaces the old logic of populating a field on the User model.
        const defaultAddress = addresses.find(address => address.isDefault);

        // Pass both the user, all addresses, and the identified default address data to the EJS template
        res.render('user/profile/profileMain', {
            title: 'My Profile',
            user: user,
            addresses: addresses || [], // Ensure addresses is an array, even if empty
            defaultAddress: defaultAddress ,// Pass the correctly identified default address
             
        });
    } catch (error) {
        console.error("Error fetching profile page:", error);
        res.status(500).render('error', { message: 'Failed to load profile page.' });
    }
};



exports.getProfileSection = async (req, res) => {
    const { sectionName } = req.params;
    const user = req.user;
    try {
        let data = { user: null };
        let templatePath = '';

        if (user && user._id) {
            // Fetch the user without trying to populate a non-existent defaultAddress field.
            data.user = await User.findById(user._id).lean();
            if (!data.user) {
                console.error("User not found for dynamic section:", user._id);
                return res.status(404).send('<p class="text-red-400">User data not available for this section.</p>');
            }
        } else {
            console.error("User not authenticated or user ID missing for dynamic section.");
            return res.status(401).send('<p class="text-red-400">Authentication required for this section.</p>');
        }

        switch (sectionName) {
            case 'profile':
                // Fetch all addresses for the profile section
                const addressesForProfile = await Address.find({ user_id: user._id }).lean();
                data.addresses = addressesForProfile;
                // Correctly find the default address from the fetched addresses
                data.defaultAddress = addressesForProfile.find(address => address.isDefault);
                templatePath = 'user/profile/partials/_profileDetails';
                break;
            case 'wishlist':
            case 'wallet':
                templatePath = 'user/profile/partials/_comingSoon';
                data.message = `${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} Section is coming soon!`;
                break;
                 case 'orders':
    const orders = await Order.find({ user_id: user._id })
        .sort({ createdAt: -1 })
        .populate({
            path: 'products.product_id',
            // Select the product's title and the entire colorVariants array
            select: 'title colorVariants'
        })
        .lean();
    
    // Process the orders data to select the correct image for each item
    // The image path is now in order.products[i].product_id.colorVariants[j].images[k]
    // The front-end template will need to handle this nested structure.

    data.orders = orders;
    templatePath = 'user/profile/partials/_orderList';
    break;
            case 'address':
                // Fetch all addresses for the address section
                const addresses = await Address.find({ user_id: user._id }).lean();
                data.addresses = addresses;
                // Correctly find the default address from the fetched addresses
                data.defaultAddress = addresses.find(address => address.isDefault);
                templatePath = 'user/profile/partials/_address';
                break;
            case 'change-password':
                templatePath = 'user/profile/partials/_changePasswordForm';
                data = {};
                break;
            default:
                return res.status(404).send('<p class="text-red-400">Requested section not found.</p>');
        }
        console.log(data.orders&&data.orders[0].products[0].product_id.colorVariants)
        // console.log(data.orders[0].products)
       
        // Render with the updated data
        res.render(templatePath, { ...data,  layout: false }, (err, html) => {
            if (err) {
                console.error(`Error rendering partial ${templatePath}:`, err);
                return res.status(500).send('<p class="text-red-400">Error rendering section content.</p>');
            }
            res.send(html);
        });

    } catch (error) {
        console.error(`Error fetching data for section ${sectionName}:`, error);
        res.status(500).send('<p class="text-red-400">Failed to load section data due to server error.</p>');
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        // Fetch the user first to get their current state for image deletion and other checks
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const { firstname, lastname, email, mobile, originalEmail, addressId } = req.body;
        
        // --- FORM VALIDATION ---
        const errors = {};
        
        if (!firstname || firstname.trim() === '') {
            errors.firstname = "First name is required.";
        } else if (firstname.trim().length < 2) {
            errors.firstname = "First name must be at least 2 characters long.";
        }

        if (!lastname || lastname.trim() === '') {
            errors.lastname = "Last name is required.";
        } else if (lastname.trim().length < 2) {
            errors.lastname = "Last name must be at least 2 characters long.";
        }

        if (!email || email.trim() === '') {
            errors.email = "Email is required.";
        } else if (!/^\S+@\S+\.\S+$/.test(email)) {
            errors.email = "Please enter a valid email address.";
        }

        if (mobile && mobile.trim() !== '' && !/^\d{10}$/.test(mobile)) {
            errors.mobile = "Mobile number must be 10 digits long.";
        }

        // Check if the addressId is a valid ObjectId if provided
        if (addressId && !mongoose.Types.ObjectId.isValid(addressId)) {
            errors.addressId = "Invalid address ID provided.";
        }
        
        // Return validation errors if any exist
        if (Object.keys(errors).length > 0) {
            // Delete the newly uploaded file if validation fails
            if (req.file) {
                const newImagePath = path.join(__dirname, '..', '..', 'public', req.file.path);
                await fs.unlink(newImagePath).catch(err => console.error("Error deleting new file after validation error:", err.message));
            }
            return res.status(400).json({ message: "Validation failed.", errors });
        }
        // --- END OF VALIDATION ---

        // Check for email change before any database actions
        if (email !== originalEmail) {
            if (req.file) {
                const newImagePath = path.join(__dirname, '..', '..', 'public', req.file.path);
                await fs.unlink(newImagePath).catch(err => console.error("Error deleting new file after validation error:", err.message));
            }
            return res.status(400).json({ message: "Changing email requires verification. This feature is not yet fully implemented." });
        }
        
        // Initialize update data with validated body fields
        let updateData = {
            firstname,
            lastname,
            email,
            mobile: mobile || null,
        };

        // Handle default address update logic
        if (addressId) {
            // Find the current default address and set its `isDefault` flag to false
            await Address.findOneAndUpdate(
                { user_id: userId, isDefault: true },
                { $set: { isDefault: false } }
            );

            // Set the new address as the default
            await Address.findByIdAndUpdate(
                addressId,
                { $set: { isDefault: true } },
                { new: true }
            );
        }

        // Handle profile image upload if a new file is provided
        if (req.file) {
            // Delete the old profile image if it exists and is not the default image
            if (user.profileImage && user.profileImage !== '/images/default-profile.png') {
                const oldImagePath = path.join(__dirname, '..', '..', 'public', user.profileImage);
                try {
                    await fs.unlink(oldImagePath);
                } catch (err) {
                    console.error("Error deleting old profile image:", err.message);
                }
            }
            // Add the new image path to the update data
            updateData.profileImage = `/uploads/profileImages/${req.file.filename}`;
        }
        
        // Update the user document with the basic profile details
        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true });
        
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found after update." });
        }
        
        res.status(200).json({ message: "Profile updated successfully!", user: updatedUser });

    } catch (err) {
        if (err.name === 'ValidationError') {
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
// --- NEW FUNCTION: To set an address as default ---
exports.setDefaultAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const userId = req.user._id;

        // Step 1: Find the address to be set as default and verify it belongs to the user.
        // We'll update this one last to ensure it's the final default.
        const address = await Address.findOne({ _id: addressId, user_id: userId });
        if (!address) {
            return res.status(404).json({ message: 'Address not found or unauthorized.' });
        }

        // Step 2: Clear the 'isDefault' flag for ALL other addresses of this user.
        // This is crucial to ensure only one address is ever the default.
        await Address.updateMany(
            { user_id: userId, _id: { $ne: addressId } },
            { $set: { isDefault: false } }
        );

        // Step 3: Set the 'isDefault' flag to true for the selected address.
        const updatedAddress = await Address.findByIdAndUpdate(
            addressId,
            { $set: { isDefault: true } },
            { new: true, runValidators: true }
        );

        if (!updatedAddress) {
            return res.status(404).json({ message: "Address not found during update." });
        }

        // If both updates are successful, send a success response.
        res.status(200).json({ message: 'Default address updated successfully!', address: updatedAddress });

    } catch (error) {
        console.error('Error setting default address:', error);
        res.status(500).json({ message: 'Failed to set default address. Please try again.' });
    }
};



exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const errors = {};

    if (!currentPassword || !newPassword || !confirmPassword) {
        errors.general = 'All password fields are required.';
        return res.status(400).json({ success: false, message: errors.general, errors });
    }
    
    if (newPassword !== confirmPassword) {
        errors.confirmPassword = 'New password and confirm password do not match.';
    }
    if (newPassword.length < 4) {
        errors.newPassword = 'New password must be at least 4 characters long.';
    }
    if (!/[A-Z]/.test(newPassword)) {
        errors.newPassword = errors.newPassword ? errors.newPassword + ' And must contain at least one uppercase letter.' : 'New password must contain at least one uppercase letter.';
    }
    if (!/[a-z]/.test(newPassword)) {
        errors.newPassword = errors.newPassword ? errors.newPassword + ' And must contain at least one lowercase letter.' : 'New password must contain at least one lowercase letter.';
    }
    if (!/[0-9]/.test(newPassword)) {
        errors.newPassword = errors.newPassword ? errors.newPassword + ' And must contain at least one number.' : 'New password must contain at least one number.';
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
        errors.newPassword = errors.newPassword ? errors.newPassword + ' And must contain at least one special character.' : 'New password must contain at least one special character.';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ success: false, message: 'Validation failed. Please check your inputs.', errors });
    }

    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        
        if (!isMatch) {
            errors.currentPassword = 'Incorrect current password.';
            return res.status(400).json({ success: false, message: errors.currentPassword, errors });
        }
        
        const isNewSameAsCurrent = await bcrypt.compare(newPassword, user.password);
        if (isNewSameAsCurrent) {
            errors.newPassword = 'New password cannot be the same as your current password.';
            return res.status(400).json({ success: false, message: errors.newPassword, errors });
        }
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt); 

        await user.save();

        res.status(200).json({ success: true, message: 'Password updated successfully!' });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'Server error. Could not update password.' });
    }
};

///add adress///
exports.addAddress = async (req, res) => {
    try {
        const { name, mobile, address1, address2, city, state, pincode, country } = req.body;
        const validationErrors = [];
        if (!name) validationErrors.push('Name is required.');
        if (!mobile) validationErrors.push('Mobile number is required.');
        if (!address1) validationErrors.push('Address Line 1 is required.');
        if (!city) validationErrors.push('City is required.');
        if (!state) validationErrors.push('State is required.');
        if (!pincode) validationErrors.push('Pincode is required.');
        if (validationErrors.length > 0) {
            return res.status(400).json({
                message: 'Validation failed. Please provide all required fields.',
                errors: validationErrors
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
            country
        });
        await newAddress.save();
        // Set the first added address as the default
        const user = await User.findById(req.user._id);
        if (user && !user.defaultAddress) {
            user.defaultAddress = newAddress._id;
            await user.save();
        }
        res.status(201).json({
            message: 'Address added successfully!',
            address: newAddress
        });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ message: 'Failed to add address. Please try again.' });
    }
};


///edit address///
exports.editAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const { name, mobile, address1, address2, city, state, pincode, country } = req.body;
        const updatedFields = {};
        if (name) updatedFields.name = name;
        if (mobile) updatedFields.mobile = mobile;
        if (address1) updatedFields.address1 = address1;
        if (address2) updatedFields.address2 = address2;
        if (city) updatedFields.city = city;
        if (state) updatedFields.state = state;
        if (pincode) updatedFields.pincode = pincode;
        if (country) updatedFields.country = country;
        if (Object.keys(updatedFields).length === 0) {
            return res.status(400).json({
                message: 'No fields to update. Please provide at least one field to change.'
            });
        }
        const updatedAddress = await Address.findOneAndUpdate(
            { _id: addressId, user_id: req.user._id },
            { $set: updatedFields },
            { new: true, runValidators: true }
        );
        if (!updatedAddress) {
            return res.status(404).json({ message: 'Address not found or you are not authorized to edit it.' });
        }
        res.status(200).json({
            message: 'Address updated successfully!',
            address: updatedAddress
        });
    } catch (error) {
        console.error('Error updating address:', error);
        res.status(500).json({ message: 'Failed to update address. Please try again.' });
    }
};


////remove address////
exports.removeAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const deletedAddress = await Address.findOneAndDelete({
            _id: addressId,
            user_id: req.user._id
        });
        if (!deletedAddress) {
            return res.status(404).json({ message: 'Address not found or unauthorized.' });
        }
        // If the deleted address was the default, clear the user's defaultAddress
        const user = await User.findById(req.user._id);
        if (user && user.defaultAddress && user.defaultAddress.toString() === addressId) {
            user.defaultAddress = undefined; // Or set to null
            await user.save();
        }
        res.status(200).json({ message: 'Address removed successfully!' });
    } catch (error) {
        console.error('Error removing address:', error);
        res.status(500).json({ message: 'Failed to remove address. Please try again.' });
    }
};
