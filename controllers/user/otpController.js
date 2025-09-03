const User = require("../../model/user.js");
const Otp = require("../../model/otp.js");
const { sendMail } = require("../../utils/otpMailer1.js");
const bcrypt = require("bcrypt");
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
      return res.redirect(
        `/forgot-password?error=${encodeURIComponent(
          "Please enter a valid email or 10-digit phone number."
        )}`
      );
    }

    if (!user) {
      return res.redirect(
        `/forgot-password?error=${encodeURIComponent(
          "No account found for this email/phone."
        )}`
      );
    }

    const otpCode = crypto.randomInt(100000, 999999).toString();

    await Otp.deleteMany({ email: user.email });

    const newOtpRecord = new Otp({
      email: user.email,
      otp: otpCode,
      context: "forgot-password",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
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

    res.redirect(
      `/verify-otp?email=${encodeURIComponent(
        user.email
      )}&context=forgot-password`
    );
  } catch (err) {
    console.error("Error in postForgotPassword:", err);
    res.redirect(
      `/forgot-password?error=${encodeURIComponent(
        "An error occurred. Please try again."
      )}`
    );
  }
};

exports.getOtpPage = async (req, res) => {
  const email = req.query.email || "";
  const context = req.query.context || "unknown";
  let otpExpiresAt = null;

  if (!email) {
    if (context === "signup")
      return res.redirect(
        "/signup?error=" +
          encodeURIComponent("Email missing for OTP verification.")
      );
    if (context === "forgot-password")
      return res.redirect(
        "/forgot-password?error=" +
          encodeURIComponent("Email missing for OTP verification.")
      );
    return res.redirect("/");
  }

  try {
    const latestOtp = await Otp.findOne({ email, context })
      .sort({ createdAt: -1 })
      .exec();
    if (latestOtp && latestOtp.expiresAt > new Date()) {
      otpExpiresAt = latestOtp.expiresAt.getTime();
    }
  } catch (error) {
    console.error("Error fetching latest OTP for timer:", error);
  }
  res.render("user/otp", {
    error: req.query.error || null,
    title: "Verify OTP",
    isAuthPage: true,
    email: email,
    context: context,
    otpExpiresAt: otpExpiresAt,
  });
};

exports.postVerifyOtp = async (req, res) => {
  console.log("1. Inside postVerifyOtp");
  const { email, otp, context } = req.body;
  console.log("2. Received data:", { email, otp, context });

  try {
    console.log("3. Searching for OTP...");
    const otpRecord = await Otp.findOne({ email, otp, context });
    console.log("4. OTP record found:", otpRecord);

    if (!otpRecord) {
      console.log("5. Invalid OTP or not found.");
      return res.redirect(
        `/verify-otp?email=${email}&context=${context}&error=${encodeURIComponent(
          "Invalid or expired OTP."
        )}`
      );
    }
    console.log("6. Checking OTP expiration...");
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });
      console.log("7. OTP expired.");
      return res.redirect(
        `/verify-otp?email=${email}&context=${context}&error=${encodeURIComponent(
          "OTP expired. Please resend."
        )}`
      );
    }
    console.log("8. OTP is valid. Processing based on context:", context);

    if (context === "signup") {
      console.log("9. Context is signup. Verifying user...");
      const user = await User.findOne({ email });
      if (user) {
        user.isVerified = true;
        await user.save();
        console.log("10. User verified for signup. Deleting OTP...");
        await Otp.deleteOne({ _id: otpRecord._id });
        console.log("11. OTP deleted. Destroying session and redirecting...");
        req.session.destroy((err) => {
          if (err) {
            console.error("Session destroy error:", err);
            return res
              .status(500)
              .json({
                success: false,
                message: "An internal server error occurred.",
              });
          }
          return res.redirect(
            "/login?message=" +
              encodeURIComponent(
                "Account created and verified successfully! Please log in."
              )
          );
        });
      } else {
        console.log("12. User not found for signup context after valid OTP.");
        return res.redirect(
          `/verify-otp?email=${email}&context=${context}&error=${encodeURIComponent(
            "User not found. Please try signing up again."
          )}`
        );
      }
    } else if (context === "forgot-password") {
      console.log(
        "13. Context is forgot-password. Setting session and redirecting to reset page..."
      );
      await Otp.deleteOne({ _id: otpRecord._id });
      req.session.otpVerified = true;
      req.session.emailOrPhone = email;
      req.session.save(() => {
        console.log("14. Session saved. Redirecting to /reset-password");
        return res.redirect("/reset-password");
      });
    } else {
      console.log("15. Unknown context:", context);
      return res.redirect(
        `/verify-otp?email=${email}&context=${context}&error=${encodeURIComponent(
          "Unknown verification context."
        )}`
      );
    }
  } catch (error) {
    console.error("*** Error in postVerifyOtp:", error);

    return res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
};

// POST /resend-otp
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
      emailSubject = "Nutrixo: Resend OTP for Account Verification";
      emailHtml = `<p>Your new OTP for Nutrixo account verification is: <strong>${newOtpCode}</strong></p>
                         <p>This OTP is valid for <b>5 minutes</b>. Do not share it with anyone.</p>`;
    } else if (context === "forgot-password") {
      emailSubject = "Nutrixo: Resend OTP for Password Reset";
      emailHtml = `<div style="font-family:Arial,sans-serif;padding:20px;">
              <h2>Hello ${user.firstname || ""}</h2>
              <p>Here is your new OTP to reset your Nutrixo account password:</p>
              <h1 style="background:#eee;padding:10px 20px;width:fit-content;border-radius:5px;">${newOtpCode}</h1>
              <p>This OTP is valid for <b>5 minutes</b>. Do not share it with anyone.</p> // Consistent 5 minutes
              <br>
              <p>Cheers,<br>The Nutrixo Team </p>
            </div>`;
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Unknown context for OTP resend." });
    }

    await sendMail(emailOrPhone, emailSubject, emailHtml);

    req.session.lastOtpResendTime = Date.now();
    await req.session.save();

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

// POST /reset-password
exports.postResetPassword = async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  const emailOrPhone = req.session.emailOrPhone;

  if (!emailOrPhone) {
    return res.redirect(
      "/forgot-password?error=" +
        encodeURIComponent("Session expired. Please restart password reset.")
    );
  }

  if (newPassword !== confirmPassword) {
    return res.redirect(
      "/reset-password?error=" + encodeURIComponent("Passwords do not match.")
    );
  }

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+}{"':;?/>.<,])(.{8,})$/;
  if (!passwordRegex.test(newPassword)) {
    return res.redirect(
      "/reset-password?error=" +
        encodeURIComponent(
          "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character."
        )
    );
  }

  try {
    let user;

    const isEmail = emailOrPhone.includes("@");
    const isMobile = /^\d{10}$/.test(emailOrPhone);

    if (isEmail) {
      user = await User.findOne({ email: emailOrPhone });
    } else if (isMobile) {
      user = await User.findOne({ mobile: emailOrPhone });
    } else {
      console.error(
        "Invalid emailOrPhone in session during password reset:",
        emailOrPhone
      );
      return res.redirect(
        "/forgot-password?error=" +
          encodeURIComponent(
            "Invalid user identifier in session. Please start the process again."
          )
      );
    }

    if (!user) {
      console.error("User not found during password reset for:", emailOrPhone);
      return res.redirect(
        "/forgot-password?error=" +
          encodeURIComponent("User not found. Please start the process again.")
      );
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    req.session.otpVerified = false;
    req.session.emailOrPhone = null;
    req.session.save(() => {
      res.redirect(
        "/login?message=" +
          encodeURIComponent(
            "Password has been reset successfully! Please log in."
          )
      );
    });
  } catch (err) {
    console.error("Error in postResetPassword:", err);
    res.redirect(
      "/reset-password?error=" +
        encodeURIComponent("An error occurred while resetting your password.")
    );
  }
};
