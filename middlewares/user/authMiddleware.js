const User = require('../../model/user.js');
const Otp = require('../../model/otp.js'); 

const isAuthenticated = async (req, res, next) => {
    if (req.session && req.session.user && req.session.user._id) {
        try {
            const user = await User.findById(req.session.user._id).lean();
            if (!user) {
                const logoutMessage = 'Your session is invalid or user not found. Please log in again.';
                req.session.destroy(err => {
                    if (err) console.error("Error destroying session (user not found):", err);
                    res.clearCookie('connect.sid');
                    return res.redirect(`/login?error=${encodeURIComponent(logoutMessage)}`);
                });
                return;
            }
            if (user.status !== "active") {
                const logoutMessage = 'Your account has been deactivated or blocked. Please contact support.';
                req.session.destroy(err => {
                    if (err) console.error("Error destroying session (account status):", err);
                    res.clearCookie('connect.sid');
                    return res.redirect(`/login?error=${encodeURIComponent(logoutMessage)}`);
                });
                return;
            }
            if (!user.isVerified) {
                const emailParam = user.email ? `email=${encodeURIComponent(user.email)}` : '';
                const redirectToUrl = `/verify-otp?${emailParam}&context=signup&error=${encodeURIComponent('Your account is not verified. Please verify your email.')}`;
                return res.redirect(redirectToUrl);
            }
            req.user = user;
            return next();
        } catch (error) {
            console.error("Error fetching user from session in isAuthenticated middleware:", error);
            const errorMessage = 'An error occurred during authentication. Please log in again.';
            req.session.destroy(err => {
                if (err) console.error("Error destroying session after database error:", err);
                res.clearCookie('connect.sid');
                return res.redirect(`/login?error=${encodeURIComponent(errorMessage)}`);
            });
            return;
        }
    } else {
        const errorMessage = 'Please log in to access this page.';
        req.session.returnTo = req.originalUrl;
        return res.redirect(`/login?error=${encodeURIComponent(errorMessage)}`);
    }
};
const isNotAuthenticated = (req, res, next) => {
    if (!req.session || !req.session.user || !req.session.user._id) {
        return next();
    } else {
        return res.redirect('/login'); 
    }
};
const isVerified = async (req, res, next) => {
    if (!req.user) {
        return res.redirect('/login?error=' + encodeURIComponent('Authentication required for verification check.'));
    }
    if (req.user.isVerified) {
        return next();
    }
    const emailParam = req.user.email ? `email=${encodeURIComponent(req.user.email)}` : '';
    const redirectToUrl = `/verify-otp?${emailParam}&context=signup&error=${encodeURIComponent('Your account is not verified. Please verify your email.')}`;
    return res.redirect(redirectToUrl);
};


module.exports = { isAuthenticated, isNotAuthenticated, isVerified };