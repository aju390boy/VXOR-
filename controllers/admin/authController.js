const Admin = require('../../model/admin.js');
const bcrypt = require('bcrypt');


exports.getAdminLoginPage = (req, res) => {
  
    res.render('admin/login', {
        title: 'Admin Login',
        isAuthPage: true,
        errorMessage: req.query.error ? decodeURIComponent(req.query.error) : null,
        successMessage: req.query.success ? decodeURIComponent(req.query.success) : null,
        oldEmail: req.query.oldEmail ? decodeURIComponent(req.query.oldEmail) : '' 
    });
};



exports.postAdminLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const adminUser = await Admin.findOne({ email });

        console.log('Admin User Found:', adminUser ? 'Yes' : 'No');
        if (adminUser) {
            console.log('Stored Admin Hash:', adminUser.password);
        }


        if (!adminUser) {
            return res.render('admin/login', {
                title: 'Admin Login',
                isAuthPage: true,
                errorMessage: 'Invalid credentials or not authorized.',
                oldEmail: email
            });
        }

        const isMatch = await bcrypt.compare(password, adminUser.password);
        if (!isMatch) {
            return res.render('admin/login', {
                title: 'Admin Login',
                isAuthPage: true,
                errorMessage: 'Invalid credentials.',
                oldEmail: email
            });
        }
                req.session.adminId = adminUser._id; 
                req.session.adminEmail = adminUser.email;
                req.session.role = 'admin';

        const successMessage = encodeURIComponent('Admin logged in successfully!');
        return req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).render('admin/login', {
                    title: 'Admin Login',
                    isAuthPage: true,
                    errorMessage: 'Session error during login.',
                    oldEmail: email
                });
            }
            res.redirect(`/admin/dashboard?success=${successMessage}`);
        });

    } catch (error) {
        console.error("Admin Login Error:", error);
        if (error.message && error.message.includes('Invalid salt version') || error.message.includes('data and salt arguments required')) {
            console.error('Bcrypt Error: Stored password might not be a valid bcrypt hash!');
            console.error('Stored password was:', adminUser ? adminUser.password : 'N/A (user not found)');
        }
        return res.render('admin/login', {
            title: 'Admin Login',
            isAuthPage: true,
            errorMessage: 'An unexpected error occurred during login.',
            oldEmail: email
        });
    }
};

exports.logoutUser = (req, res) => {
  req.logout(err => {
    if (err) {
      console.error('Logout Error:', err);
      return res.status(500).send('Logout Failed');
    }

    req.session.destroy(err => {
      if (err) {
        console.error('Session Destroy Error:', err);
        return res.status(500).send('Could not end session');
      }

      res.clearCookie('connect.sid'); 
      res.redirect('/admin/login'); 
      
    });
  });
};
