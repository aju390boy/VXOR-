const User = require('../../model/user.js');
const Otp = require('../../model/otp');
const bcrypt = require('bcrypt');
const { sendMail } = require('../../utils/otpMailer1.js');
const crypto = require('crypto');

exports.signup = (req, res) => {
    res.render('user/signup', { title: 'Signup', isAuthPage: true });
}

exports.signupadd = async (req, res) => {
    const { firstname, lastname, mobile, email, password, confirmPassword } = req.body;

   
    const errors = [];
    if (!firstname || !lastname || !mobile || !email || !password || !confirmPassword) {
        errors.push('All fields are required.');
    }
    if (password !== confirmPassword) {
        errors.push('Passwords do not match.');
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+}{"':;?/>.<,])(.{8,})$/;
    if (password && !passwordRegex.test(password)) {
        errors.push('Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.');
    }
    if (mobile && !/^\d{10}$/.test(mobile)) {
        errors.push('Mobile number must be 10 digits.');
    }
    if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors.join('<br>') });
    }

    try {
        let user = await User.findOne({ email });

        if (user && user.isVerified) {
            return res.status(409).json({ success: false, message: 'User with this email already exists and is verified. Please login.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otpCode = crypto.randomInt(100000, 999999).toString();

        if (user) {
            user.firstname = firstname;
            user.lastname = lastname;
            user.mobile = mobile;
            user.password = hashedPassword;
            user.isVerified = false; 
            await user.save();
        } else {
            user = new User({
                firstname: firstname,
                lastname: lastname,
                mobile: mobile,
                email: email,
                password: hashedPassword,
                isVerified: false
            });
            await user.save();
        }
       await Otp.deleteMany({ email: email });
const newOtpRecord = new Otp({
    email: email,
    otp: otpCode,
    context: 'signup', 
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) 
});


console.log('OTP document being saved (signup):', {
    email: newOtpRecord.email,
    otp: newOtpRecord.otp,
    context: newOtpRecord.context,
    expiresAt: newOtpRecord.expiresAt
});

await newOtpRecord.save();

       
        const emailSubject = 'VXOR: Verify Your Account';
        const emailHtml = `<p>Dear ${firstname},</p>
                           <p>Your One-Time Password (OTP) for Nutrixo account verification is: <strong>${otpCode}</strong></p>
                           <p>This OTP is valid for 10 minutes. Do not share it with anyone.</p>
                           <p>Thank you,<br>VXOR Team</p>`;
        await sendMail(email, emailSubject, emailHtml); 
        res.status(201).json({
            success: true,
            message: 'Account created! Please check your email for OTP verification.',
            redirectTo: `/verify-otp?email=${encodeURIComponent(email)}&context=signup`
        });

    } catch (err) {
        console.error('Error during signup:', err);
        res.status(500).json({ success: false, message: "An error occurred on the server while creating your account." });
    }
};