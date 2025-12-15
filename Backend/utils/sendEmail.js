const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Dùng Gmail
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_EMAIL,   // Email của bạn
            pass: process.env.SMTP_PASSWORD // Mật khẩu ứng dụng (App Password)
        }
    });

    const message = {
        from: `Chess Game <${process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message
    };

    await transporter.sendMail(message);
};

module.exports = sendEmail;