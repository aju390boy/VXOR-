
const User=require('../../model/user.js')
const bcrypt=require('bcrypt')


exports.login=(req,res)=> {
    const message= req.session.message;
    delete req.session.message;
 res.render('user/login', { title:'Login',message, isAuthPage: true });
}

exports.googleLoginSuccess = (req, res) => {
  const user = req.user;
   req.session.user = {
      _id: user._id,
      email: user.email,
    };
     res.redirect('/user/home');
};



////user logout logic\\\\\
exports.logoutUser = (req, res) => {
    req.logout(err => {
        if (err) {
            console.error('Passport Logout Error (User):', err);   
        }
        req.session.destroy(err => {
            if (err) {
                console.error('Session Destroy Error (User):', err);
               
                res.clearCookie('connect.sid'); 
                return res.status(500).send('Could not end user session gracefully. Please try again.');
            }
            res.clearCookie('connect.sid'); 
            console.log('User session destroyed. Redirecting to /login');
            res.redirect('/login'); 
        });
    });
};