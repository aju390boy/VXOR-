
const passport=require('passport');


exports.login=(req,res)=> {
    const alerts = req.query.message;
    const message= req.session.message;
    delete req.session.message;
    
 res.render('user/login', { title:'Login',message, alerts,isAuthPage: true });
}

exports.loginPost = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) { return next(err); }
    if (!user) {
      req.session.message = {
        icon: 'error',
        title: 'Login Failed',
        text: info.message || 'Invalid credentials.',
        background: '#1e1e1e',
        color: '#ffffff',
        width: '450px'
      };
      return res.redirect('/login');
    }
    req.logIn(user, err => {
      if (err) return next(err);
      req.session.message = {
        icon: 'success',
        title: 'Login Successful',
        text: 'Welcome back!',
        background: '#1e1e1e',
        color: '#ffffff',
        width: '450px'
      };
      return res.redirect('/user/home');
    });
  })(req, res, next);
};


exports.googleLoginSuccess = (req, res) => {
  const user = req.user;
   req.session.user = {
      _id: user._id,
      email: user.email,
    };
     res.redirect('/user/home');
};


