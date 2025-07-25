const nodemailer = require('nodemailer');

// reusable transporter config (use Gmail or custom SMTP)
const transporter = nodemailer.createTransport({
  service: 'gmail', // or use 'hotmail', 'yahoo', or custom SMTP
  auth: {
    user: process.env.MAIL_USER,     // your Gmail
    pass: process.env.MAIL_PASS,     // your App Password (not regular password)
  },
});

exports.sendOtp = async (email, otp) => {
  try {
    const mailOptions = {
      from: `"VXOR Support" <${process.env.MAIL_USER}>`,
      to: email,
      subject: 'Your OTP for Password Reset - VXOR',
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;">
          <h2>Hello </h2>
          <p>Here is your OTP to reset your VXOR account password:</p>
          <h1 style="background:#eee;padding:10px 20px;width:fit-content;border-radius:5px;">${otp}</h1>
          <p>This OTP is valid for <b>10 minutes</b>. Do not share it with anyone.</p>
          <br>
          <p>Cheers,<br>The VXOR Team </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(' OTP email sent:', info.messageId);
  } catch (err) {
    console.error(' Error sending OTP:', err.message);
    throw err;
  }
};
