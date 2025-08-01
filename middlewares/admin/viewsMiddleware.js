const isAuthenticated = async (req, res, next) => {
    if (req.session && req.session.adminId) {
        next();
    } else {
        return res.redirect('/admin/login');
    }
};

const isNotAuthenticated = (req, res, next) => {
    if (!req.session || !req.session.adminId) {
        return next();
    } else {
        return res.redirect('/admin/dashboard');
    }
};

module.exports = { isAuthenticated, isNotAuthenticated };