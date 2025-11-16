
const isAuthenticated = (req, res, next) => {
  const isLoggedIn = req.isAuthenticated && req.isAuthenticated();
  if (!isLoggedIn || !req.user || !req.user._id ) {
    req.session.message = {
      icon: 'error',
      title: '⚠️ Session Expired',
      text: 'Your session has expired. Please login again.'
    };
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  if (req.user.status !== 'active') {
    req.session.message = {
      icon: 'error',
      title: '⚠️ Access Denied',
      text: 'Your account is blocked. You can’t access this page.'
    };
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  return next();
};



const isNotAuthenticated = (req, res, next) => {
  const isLoggedIn = req.isAuthenticated && req.isAuthenticated();

  if (!isLoggedIn || !req.user || !req.user._id || req.user.status === 'blocked' || !req.user.isVerified) {
    return next();
  }

  return res.redirect('/user/home');
};


const isVerified = (req, res, next) => {
  if (!req.user) {
    req.session.message = {
      icon: 'error',
      title: '⚠️ Authentication Required',
      text: 'Authentication required for verification check.'
    };
    return res.redirect('/login');
  }

  if (req.user.isVerified) {
    return next();
  }

  const emailParam = req.user.email ? `email=${encodeURIComponent(req.user.email)}` : '';
  return res.redirect(`/verify-otp?${emailParam}&context=signup`);
};

module.exports = { isAuthenticated, isNotAuthenticated, isVerified };
