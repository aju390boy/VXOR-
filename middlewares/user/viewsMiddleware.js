
module.exports = (req, res, next) => {
    res.locals.appName = 'Nutrixo';
    res.locals.currentUser = req.session.user || null;
    const authPaths = ['/login', '/signup', '/verify-otp', '/forgot-password', '/reset-password'];
    res.locals.isAuthPage = authPaths.includes(req.path);
    res.locals.successMessage = req.query.message || null;
    res.locals.errorMessage = req.query.error || null;
    next();
};