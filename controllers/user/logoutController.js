
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

