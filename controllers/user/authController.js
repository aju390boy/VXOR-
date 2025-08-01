// controllers/authController.js
const User=require('../../model/user.js')
const bcrypt=require('bcrypt')

////Post login\\\\
exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic server-side validation (can be more extensive)
        if (!email || !password) {
            return res.status(400).json({ status: false, message: 'Email and password are required.' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ status: false, message: 'Invalid credentials' }); // Use 401 for unauthorized
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ status: false, message: 'Invalid credentials' }); // Use 401 for unauthorized
        }

        // Check if user is blocked/active (if you have such a field in your User model)
        // Example: if (user.isBlocked) { return res.status(403).json({ status: false, message: 'Your account is blocked.' }); }

        req.session.user = {
            _id: user._id,
            email: user.email,
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ status: false, message: 'Login failed due to session error.' });
            }
            // IMPORTANT CHANGE: Send JSON success response instead of redirect
            res.status(200).json({ status: true, message: 'Login successful!' });
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ status: false, message: 'An internal server error occurred during login.' });
    }
};







exports.login=(req,res)=> {
 res.render('user/login', { title: 'Sign up', isAuthPage: true });
}

exports.googleLoginSuccess = (req, res) => {
  // After Google login success
  const user = req.user;

   req.session.user = {
      _id: user._id,
      email: user.email,
    };
    console.log("Session User:", req.session.user);

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