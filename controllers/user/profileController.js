
const { use } = require('passport');
const User = require('../../model/user.js'); 
const bcrypt = require('bcrypt')
const multer = require('multer');
const path=require('path');
const Address=require('../../model/address.js')

// Configure Multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/profileImages/'); // Set your upload directory
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
        const user = await User.findById(req.user._id).lean();

        if (!user) {
            console.error("User not found in DB for ID:", req.user._id);
            return res.status(404).render('error', { message: 'User profile not found.' });
        }

        // Fetch all addresses associated with the user
        const addresses = await Address.find({ user_id: req.user._id }).lean();

        // Pass both the user and addresses data to the EJS template
        res.render('user/profile/profileMain', {
            title: 'My Profile',
            user: user,
            addresses: addresses || [], // Ensure addresses is an array, even if empty
        });
    } catch (error) {
        console.error("Error fetching profile page:", error);
        res.status(500).render('error', { message: 'Failed to load profile page.' });
    }
};


exports.getProfileSection = async (req, res) => {
    const { sectionName } = req.params;
    const user = req.user; 

    console.log(`Attempting to load profile section: ${sectionName} for user: ${user._id}`);

    try {
        let data = { user: null }; 
        let templatePath = '';

        if (user && user._id) {
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
                // Fetch addresses for the profile section to display a summary
                const addressesForProfile = await Address.find({ user_id: user._id }).lean();
                data.addresses = addressesForProfile; // Use 'address' as the variable name
                templatePath = 'user/profile/partials/_profileDetails';
                break;
            case 'orders':
            case 'wishlist':
            case 'cart':
            case 'wallet':
                templatePath = 'user/profile/partials/_comingSoon';
                data.message = `${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} Section is coming soon!`;
                break;
            case 'address':
                // FETCH ADDRESSES HERE for the address section
                const addresses = await Address.find({ user_id: user._id }).lean();
                data.address = addresses; // Use 'address' as the variable name
                templatePath = 'user/profile/partials/_address';
                break;
            case 'change-password':
                templatePath = 'user/profile/partials/_changePasswordForm';
                data = {}; 
                break;
            default:
                return res.status(404).send('<p class="text-red-400">Requested section not found.</p>');
        }
        
        res.render(templatePath, { ...data, layout: false }, (err, html) => {
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

        // Fetch the user first to get their current state, including the profile image path
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Get all fields from the request body, including the 'addressId' which is sent from the form
        const { firstname, lastname, email, mobile, originalEmail, addressId } = req.body;
        
        // 1. Check for email change FIRST before any other actions
        if (email !== originalEmail) {
            if (req.file) {
                const newImagePath = path.join(__dirname, '..', '..', 'public', req.file.path);
                await fs.unlink(newImagePath).catch(err => console.error("Error deleting new file after validation error:", err.message));
            }
            return res.status(400).json({ message: "Changing email requires verification. This feature is not yet fully implemented." });
        }
        
        // 2. Initialize update data with body fields
        let updateData = {
            firstname,
            lastname,
            email,
            mobile: mobile || null,
        };

        // 3. Add the 'addressId' to the update data if it exists in the request body
        if (addressId) {
            updateData.defaultAddressId = addressId;
        }

        // 4. Handle profile image upload if a new file is provided
        if (req.file) {
            // Delete the old profile image if it exists and is not the default
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
        
        // 5. Update the user document in the database
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

       
        const isMatch = await (currentPassword, user.password);
      
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
        // Destructure the fields from the request body, matching the new schema.
        const { name, mobile, address1, address2, city, state, pincode, country } = req.body;

        // --- Improved Validation (Updated for new schema) ---
        // Create an array to collect all validation errors.
        const validationErrors = [];
        if (!name) validationErrors.push('Name is required.');
        if (!mobile) validationErrors.push('Mobile number is required.');
        if (!address1) validationErrors.push('Address Line 1 is required.');
        if (!city) validationErrors.push('City is required.');
        if (!state) validationErrors.push('State is required.');
        if (!pincode) validationErrors.push('Pincode is required.');

        // If any errors were found, return a 400 Bad Request with a detailed list of issues.
        if (validationErrors.length > 0) {
            return res.status(400).json({
                message: 'Validation failed. Please provide all required fields.',
                errors: validationErrors
            });
        }

        // --- Create and Save the New Address ---
        // Create a new instance of the Address model using the updated fields.
        const newAddress = new Address({
            user_id: req.user._id, // Assuming req.user is set by authentication middleware
            name,
            mobile,
            address1,
            address2,
            city,
            state,
            pincode,
            country // 'country' is now properly handled as an optional field with a default
        });

        // Save the new address to the database.
        await newAddress.save();

        // Send a success response.
        res.status(201).json({
            message: 'Address added successfully!',
            address: newAddress
        });

    } catch (error) {
        // --- Centralized Error Handling ---
        console.error('Error adding address:', error);
        res.status(500).json({ message: 'Failed to add address. Please try again.' });
    }
};

///edit address///
exports.editAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        // Destructure the fields based on the updated schema
        const { name, mobile, address1, address2, city, state, pincode, country } = req.body;

        // --- Handle Partial Updates for New Schema ---
        // Create an object to store only the fields that are actually provided in the request body.
        const updatedFields = {};
        if (name) updatedFields.name = name;
        if (mobile) updatedFields.mobile = mobile;
        if (address1) updatedFields.address1 = address1;
        if (address2) updatedFields.address2 = address2;
        if (city) updatedFields.city = city;
        if (state) updatedFields.state = state;
        if (pincode) updatedFields.pincode = pincode;
        if (country) updatedFields.country = country;

        // If no fields were provided to update, return a 400 Bad Request error.
        if (Object.keys(updatedFields).length === 0) {
            return res.status(400).json({
                message: 'No fields to update. Please provide at least one field to change.'
            });
        }

        // --- Find and Update the Address ---
        // Use findOneAndUpdate to find the address by its ID and the user's ID for security.
        const updatedAddress = await Address.findOneAndUpdate(
            { _id: addressId, user_id: req.user._id },
            { $set: updatedFields }, // Use $set to update only the specified fields.
            { new: true, runValidators: true }
        );

        // If no address was found with the given ID and user, return a 404 error.
        if (!updatedAddress) {
            return res.status(404).json({ message: 'Address not found or you are not authorized to edit it.' });
        }

        // Send a success response with the updated address.
        res.status(200).json({
            message: 'Address updated successfully!',
            address: updatedAddress
        });
    } catch (error) {
        // Log the detailed error for server-side debugging.
        console.error('Error updating address:', error);
        // Send a generic 500 Internal Server Error to the client.
        res.status(500).json({ message: 'Failed to update address. Please try again.' });
    }
};


////remove address////
exports.removeAddress = async (req, res) => {
    try {
        const { addressId } = req.params;

        // Ensure the address belongs to the current user before removing
        const deletedAddress = await Address.findOneAndDelete({
            _id: addressId,
            user_id: req.user._id
        });

        if (!deletedAddress) {
            return res.status(404).json({ message: 'Address not found or unauthorized.' });
        }

        res.status(200).json({ message: 'Address removed successfully!' });
    } catch (error) {
        console.error('Error removing address:', error);
        res.status(500).json({ message: 'Failed to remove address. Please try again.' });
    }
};