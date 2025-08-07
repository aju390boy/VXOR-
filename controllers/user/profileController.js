
const { use } = require('passport');
const User = require('../../model/user.js'); 
const bcrypt = require('bcrypt')
const multer = require('multer');
const path=require('path');

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
        console.log("User fetched from DB for profile page:", user);

        if (!user) {
            console.error("User not found in DB for ID:", req.user._id);
            return res.status(404).render('error', { message: 'User profile not found.' });
        }

 const address={user_id:'123',name:'ajith',steetAddress:'efds334',city:'kochi',state:'kerala',pincode:12345}
        res.render('user/profile/profileMain', {
            title: 'My Profile',
            user: user,
            address
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
               
              
                templatePath = 'user/profile/partials/_address';
                break;
            case 'change-password':
                templatePath = 'user/profile/partials/_changePasswordForm';
                data = {}; 
                break;
            default:
                return res.status(404).send('<p class="text-red-400">Requested section not found.</p>');
        }

       const address={user_id:'123',name:'ajith',steetAddress:'efds334',city:'kochi',state:'kerala',pincode:12345}
       
        res.render(templatePath, { ...data,address, layout: false }, (err, html) => {
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

        const { firstname, lastname, email, mobile, originalEmail } = req.body;
        
        // --- CORRECTED LOGIC ---
        // 1. IMPORTANT: Check for email change FIRST before any other actions
        if (email !== originalEmail) {
            // If the request is for an email change, handle it separately.
            // You may need to create a new route/controller for this.
            // For now, returning an error is correct.
            // We'll also remove the newly uploaded file to avoid orphaned images.
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

        // 3. Handle profile image upload if a new file is provided
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
        
        // 4. Update the user document in the database
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