const User = require("../../model/user.js");
const Otp = require("../../model/otp.js");
const { sendMail } = require("../../utils/otpMailer1.js");
const crypto = require("crypto");


exports.postResendOtp = async (req, res) => {
  const { email: emailOrPhone, context } = req.body;
  const COOLDOWN_PERIOD_MS = 60 * 1000;
  if (!emailOrPhone || !context) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Email and context are required for resend.",
      });
  }
  try {
    const lastResendTime = req.session.lastOtpResendTime || 0;
    if (Date.now() - lastResendTime < COOLDOWN_PERIOD_MS) {
      const timeLeft = Math.ceil(
        (COOLDOWN_PERIOD_MS - (Date.now() - lastResendTime)) / 1000
      );
      return res
        .status(429)
        .json({
          success: false,
          message: `Please wait ${timeLeft} seconds before resending OTP.`,
        });
    }
    const user = await User.findOne({ email: emailOrPhone });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }
    if (user.isVerified && context === "signup") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Account already verified. Please login.",
        });
    }
    const newOtpCode = crypto.randomInt(100000, 999999).toString();
    const otpValidityDuration = 5 * 60 * 1000;
    const newExpirationTime = new Date(Date.now() + otpValidityDuration);
    await Otp.deleteMany({ email: emailOrPhone, context: context });
    await Otp.create({
      email: emailOrPhone,
      otp: newOtpCode,
      context: context,
      expiresAt: newExpirationTime,
    });
    let emailSubject = "";
    let emailHtml = "";
    if (context === "signup") {
      emailSubject = "VXOR: Resend OTP for Account Verification";
      emailHtml = `<p>Your new OTP for VXOR account verification is: <strong>${newOtpCode}</strong></p>
                         <p>This OTP is valid for <b>5 minutes</b>. Do not share it with anyone.</p>`;
    } else if (context === "forgot-password") {
      emailSubject = "VXOR: Resend OTP for Password Reset";
      emailHtml = `<div style="font-family:Arial,sans-serif;padding:20px;">
              <h2>Hello ${user.firstname || ""}</h2>
              <p>Here is your new OTP to reset your VXOR account password:</p>
              <h1 style="background:#eee;padding:10px 20px;width:fit-content;border-radius:5px;">${newOtpCode}</h1>
              <p>This OTP is valid for <b>5 minutes</b>. Do not share it with anyone.</p> // Consistent 5 minutes
              <br>
              <p>Cheers,<br>VXOR Team </p>
            </div>`;
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Unknown context for OTP resend." });
    }
   console.log(`resend otp : ${newOtpCode}`);
    await sendMail(emailOrPhone, emailSubject, emailHtml);
    req.session.lastOtpResendTime = Date.now();
    await req.session.save();
    console.log(`otp : ${newOtpCode}`)
    res.status(200).json({
      success: true,
      message: "New OTP sent to your email!",
      expiresAt: newExpirationTime.getTime(),
    });
  } catch (error) {
    console.error("Error during OTP resend:", error);
    res.status(500).json({ success: false, message: "Failed to resend OTP." });
  }
};

exports.getResetPage = (req, res) => {
  if (!req.session.otpVerified || !req.session.emailOrPhone) {
    return res.redirect(
      "/forgot-password?error=" +
        encodeURIComponent("Please verify OTP first to reset password.")
    );
  }
  res.render("user/change-password", {
    error: req.query.error || null,
    title: "Change-Password",
    isAuthPage: true,
  });
};


