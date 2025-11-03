const User = require("../../model/user.js");
const bcrypt = require('bcrypt');

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

