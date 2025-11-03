
const User = require("../../model/user.js");
const Otp = require("../../model/otp.js");



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