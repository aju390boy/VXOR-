const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,   
        pass: process.env.MAIL_PASS,   
    },
});


exports.sendMail = async (to, subject, htmlContent) => {
    try {
        const mailOptions = {
            from:`"VXOR Support" <${process.env.MAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlContent,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
    } catch (err) {
        console.error('Error sending email:', err.message);
        throw err;
    }
};
