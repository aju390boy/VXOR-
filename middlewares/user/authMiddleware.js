const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user._id) {
    // User is authenticated by Passport and user attached to req.user
    return next();
  }
  // Not authenticated, redirect to login
  const errorMessage = 'Please log in to access this page.';
  req.session.returnTo = req.originalUrl;
  return res.redirect(`/login?error=${encodeURIComponent(errorMessage)}`);
};

const isNotAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user || !req.user._id) {
    return next();
  } else {
    return res.redirect('/user/home');
  }
};

const isVerified = (req, res, next) => {
  if (!req.user) {
    return res.redirect('/login?error=' + encodeURIComponent('Authentication required for verification check.'));
  }
  // Here you use your userSchema field
  if (req.user.isVerified) {
    return next();
  }
  const emailParam = req.user.email ? `email=${encodeURIComponent(req.user.email)}` : '';
  const redirectToUrl = `/verify-otp?${emailParam}&context=signup&error=${encodeURIComponent('Your account is not verified. Please verify your email.')}`;
  return res.redirect(redirectToUrl);
};

module.exports = { isAuthenticated, isNotAuthenticated, isVerified };
