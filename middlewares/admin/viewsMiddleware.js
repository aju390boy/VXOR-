
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.admin) {
    return next();
  } else {
    return res.redirect('/login'); 
  }
};

const isNotAuthenticated = (req, res, next) => {
  if (!req.session || !req.session.admin) {
    return next();
  } else {
    return res.redirect('/admin/dashboard');
  }
};

module.exports = { isAuthenticated, isNotAuthenticated };

