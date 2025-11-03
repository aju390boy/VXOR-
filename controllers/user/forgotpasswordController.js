
const User = require('../../model/user.js');
const Otp = require("../../model/otp.js");
const { sendMail } = require("../../utils/otpMailer1.js");
const crypto = require("crypto");


exports.getForgotPage = (req, res) => {
  res.render("user/forgot", {
    title: "Forgot-Password",
    isAuthPage: true,
    error: req.query.error || null,
  });
};

exports.postForgotPassword = async (req, res) => {
  const emailOrPhone = req.body.emailOrPhone.trim();
  try {
    let user;
    const isEmail = emailOrPhone.includes("@");
    const isMobile = /^\d{10}$/.test(emailOrPhone);
    if (isEmail) {
      user = await User.findOne({ email: emailOrPhone });
    } else if (isMobile) {
      user = await User.findOne({ mobile: emailOrPhone });
    } else {
     return res.json({ success: false, message: "Please enter a valid email or 10-digit phone number." });
    }
    if (!user) {
      return res.json({ success: false, message: "No account found for this email/phone." });
    }
    const otpCode = crypto.randomInt(100000, 999999).toString();
    await Otp.deleteMany({ email: user.email });
    const newOtpRecord = new Otp({
      email: user.email,
      otp: otpCode,
      context: "forgot-password",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    console.log(`new otp : ${newOtpRecord}`);
    await newOtpRecord.save();
    const emailSubject = "VXOR: Password Reset OTP";
    const emailHtml = `<div style="font-family:Arial,sans-serif;padding:20px;">
             <h2>Hello ${user.firstname || ""}</h2>
             <p>Here is your OTP to reset your Nutrixo account password:</p>
             <h1 style="background:#eee;padding:10px 20px;width:fit-content;border-radius:5px;">${otpCode}</h1>
             <p>This OTP is valid for <b>10 minutes</b>. Do not share it with anyone.</p>
             <br>
             <p>Cheers,<br>The VXOR Team </p>
           </div>`;
    await sendMail(user.email, emailSubject, emailHtml);
    res.json({success:true,message: "OTP sent", email: user.email})
  } catch (err) {
    console.error("Error in postForgotPassword:", err);
    res.json({success:false,message:'error occurd in sever '})
  }
};