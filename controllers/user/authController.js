// controllers/authController.js
const User=require('../../model/user.js')
const Admin = require('../../model/admin.js')
const bcrypt=require('bcrypt')
const { sendOtp } = require('../../utils/otpMailer.js');
const Otp = require('../../model/otp.js')




exports.signupadd=async (req,res)=>{
  const {firstname,lastname,mobile,email,password,confirmPassword}=req.body
  if(!firstname||!lastname||!mobile||!email||!password||!confirmPassword){
    return res.status(400).json({success:false,message:'all fields are required'})
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }
  const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(password, 10);


  try{
    const existingUser=await User.findOne({email})
    if(existingUser){
      return res.json({success:false,message:'user already exist'})
    }

    const newUser=await new User({
      firstname:firstname,
      lastname:lastname,
      mobile:mobile,
      email:email,
      password:hashedPassword
    })
    await newUser.save();
    res.redirect('/login');
    
  }
  catch(err){
   console.log(err)
        res.status(500).json({success:false,message:"error occured while adding new user in server side"})
  }
}





exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    // 1. Check if admin
    const admin = await Admin.findOne({ email });

    if (admin) {
      const isAdminMatch = password === admin.password;


      if (isAdminMatch) {
        req.session.admin = {
          _id: admin._id,
          email: admin.email,
        };
        console.log("Admin session:", req.session.admin);
        return res.redirect('/admin/dashboard');
      }
    }

    // 2. Check if user
    const user = await User.findOne({ email });

    if (user) {
      const isUserMatch = await bcrypt.compare(password, user.password);

      if (isUserMatch) {
        req.session.user = {
          _id: user._id,
          email: user.email,
        };
        console.log("User session:", req.session.user);
        return res.redirect('/user/home');
      }
    }

    // 3. If no match
    return res.json({ success: false, message: 'Invalid email or password.' });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};




exports.signup=(req,res)=> {
  res.render('user/signup', { title: 'Login', isAuthPage: true })
}
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


////FORGOT PASSWORD\\\
// GET /forgot-password
exports.getForgotPage = (req, res) => {
  res.render('user/forgot', {  title: 'Forgot-Password', isAuthPage: true ,
    step: req.session.otpVerified ? 'reset' : 'otp', 
    emailOrPhone: req.session.emailOrPhone || ''
  });
};

// POST /forgot-password

exports.postForgotPassword = async (req, res) => {
  const emailOrPhone = req.body.emailOrPhone.trim(); // 🚨 always trim

  const user = await User.findOne({
    $or: [{ email: emailOrPhone }, { phone: emailOrPhone }],
  });

  if (!user) {
    return res.render('user/forgot', {
      error: 'No account found',
      emailOrPhone,
    });
  }

  // ✅ Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // ✅ Save to DB
  await Otp.deleteMany({ emailOrPhone }); // cleanup old OTPs
  await Otp.create({
    emailOrPhone,
    code:otp,
  });

  // ✅ Send OTP (via nodemailer or any service)
  await sendOtp(emailOrPhone, otp);

  // ✅ Store in session
  req.session.emailOrPhone = emailOrPhone;
  req.session.otpVerified = false;

  res.redirect('/verify-otp'); // OR render('user/otp')
};

////OTP\\\\
exports.getOtpPage = (req, res) => {
  if (!req.session.emailOrPhone) return res.redirect('/forgot-password');
  res.render('user/otp', { error: null,  title: 'OTP', isAuthPage: true  });
};
// POST /verify-otp
exports.postVerifyOtp = async (req, res) => {
  const otp = req.body.otp?.trim();
  const emailOrPhone = req.session.emailOrPhone?.trim();

  if (!emailOrPhone) {
    return res.render('user/forgot-password',{
      error: 'Empty field',
    });
  }

  const otpRecord = await Otp.findOne({
    emailOrPhone,
    code: otp,
  });
  console.log(otpRecord)
  if (!otpRecord) {
    console.log("❌ OTP mismatch or expired");
    
    return res.render('user/otp', {
      error: 'Invalid or expired OTP. Try again.',
    });
  }

  // ✅ OTP is correct
  await Otp.deleteMany({ emailOrPhone });

  req.session.otpVerified = true;
  req.session.save(() => {
    res.redirect('/reset-password');
  });
};

///RESET-PASSWORD\\\
exports.getResetPage = (req, res) => {
  if (!req.session.otpVerified){
 return res.redirect('/verify-otp');
  }
  res.render('user/change-password', { error: null ,  title: 'Change-Password', isAuthPage: true });
};

// POST /reset-password
exports.postResetPassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.render('user/change-password', {
      error: 'Passwords do not match',
    });
  }

  const emailOrPhone = req.session.emailOrPhone;
  if (!emailOrPhone) {
    return res.redirect('/forgot-password');
  }

  const user = await User.findOne({
    $or: [{ email: emailOrPhone }, { phone: emailOrPhone }],
  });

  if (!user) {
    return res.render('user/change-password', {
      error: 'User not found. Please start the process again.',
    });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  // Clear session vars
  req.session.otpVerified = false;
  req.session.emailOrPhone = null;

  res.redirect('/login');
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

      res.clearCookie('connect.sid'); // Optional: clear session cookie
      res.redirect('/login'); // Back to login page
    });
  });
};

