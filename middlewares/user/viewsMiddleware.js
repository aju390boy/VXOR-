const User = require('../../model/user.js');

const isAuthenticated = async (req, res, next) => {
    if (req.session && req.session.user && req.session.user._id) {
        try {
            const user = await User.findById(req.session.user._id).lean();

            if (user && user.status === "active") {
                req.user = user;
                return next();
            } else {
                // Determine the logout message *before* destroying the session
                const logoutMessage = user
                    ? 'Your account has been deactivated or blocked. Please contact support.'
                    : 'Your session is invalid or user not found. Please log in again.';

                // Set the flash message *before* destroying the session
                req.flash('error', logoutMessage);

                // Now destroy the session
                req.session.destroy(err => {
                    if (err) {
                        console.error("Error destroying session after status check:", err);
                    }
                    res.clearCookie('connect.sid');
                    return res.redirect('/login');
                });
                return;
            }
        } catch (error) {
            console.error("Error fetching user from session in isAuthenticated middleware:", error);

            // Set the flash message *before* destroying the session
            req.flash('error', 'An error occurred during authentication. Please log in again.');

            req.session.destroy(err => {
                if (err) {
                    console.error("Error destroying session after database error:", err);
                }
                res.clearCookie('connect.sid');
                return res.redirect('/login');
            });
            return;
        }
    } else {
        req.flash('error', 'Please log in to access this page.');
        return res.redirect('/login');
    }
};

const isNotAuthenticated = (req, res, next) => {
    if (!req.session || !req.session.user || !req.session.user._id) {
        return next();
    } else {
        return res.redirect('/user/home');
    }
};

module.exports = { isAuthenticated, isNotAuthenticated };