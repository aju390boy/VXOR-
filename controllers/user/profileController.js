
const User = require('../../model/user.js'); 
const bcrypt = require('bcrypt')


exports.getProfilePage = async (req, res) => {
    console.log("req.user in getProfilePage:", req.user);
    try {
        const user = await User.findById(req.user._id).lean(); 
        console.log("User fetched from DB for profile page:", user);

        if (!user) {
            console.error("User not found in DB for ID:", req.user._id);
            return res.status(404).render('error', { message: 'User profile not found.' });
        }

        res.render('user/profile/profileMain', {
            title: 'My Profile',
            user: user,
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

exports.updateProfile =  async (req, res) => {
    try {
       
        const userId = req.session.user._id; 
        const { firstname, lastname, email, mobile } = req.body;

       
        if (!firstname || !email) {
            return res.status(400).json({ message: 'First name and email are required.' });
        }

       
        const user = await User.findById(userId); 
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.firstname = firstname;
        user.lastname = lastname;
        user.email = email;
        user.mobile = mobile;
        await user.save();

      
        res.status(200).json({ success: true, message: 'Profile updated successfully!' });

    } catch (error) {
        console.error('Error updating profile:', error);
        
        res.status(500).json({ success: false, message: 'Failed to update profile due to a server error.' });
    }
};


exports.changePassword = async (req, res) => {
    console.log("Change password request received:", req.body);

    const { currentPassword, newPassword, confirmPassword } = req.body;
    const errors = {}; // Object to collect validation errors

    // 1. Server-Side Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        errors.general = 'All password fields are required.';
        return res.status(400).json({ success: false, message: errors.general, errors });
    }

    if (newPassword !== confirmPassword) {
        errors.confirmPassword = 'New password and confirm password do not match.';
    }
    if (newPassword.length < 8) {
        errors.newPassword = 'New password must be at least 8 characters long.';
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
        // const userId = req.user._id; // Example: if using Passport.js or similar middleware

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // 2. Verify Current Password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            errors.currentPassword = 'Incorrect current password.';
            return res.status(400).json({ success: false, message: errors.currentPassword, errors });
        }

        // 3. Prevent new password from being the same as current password
        const isNewSameAsCurrent = await bcrypt.compare(newPassword, user.password);
        if (isNewSameAsCurrent) {
            errors.newPassword = 'New password cannot be the same as your current password.';
            return res.status(400).json({ success: false, message: errors.newPassword, errors });
        }

        // 4. Hash New Password
        const salt = await bcrypt.genSalt(10); // Generate a salt
        user.password = await bcrypt.hash(newPassword, salt); // Hash the new password

        // 5. Save to Database
        await user.save();

        res.status(200).json({ success: true, message: 'Password updated successfully!' });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'Server error. Could not update password.' });
    }
};