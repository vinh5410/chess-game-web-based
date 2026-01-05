const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Dùng Gmail
    // Cấu hình chi tiết thay vì dùng service: 'gmail' để ổn định hơn
    const transporter = nodemailer.createTransport({
        host: 'smtp.googlemail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });

    const message = {
        from: `Chess Game <${process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message
    };

    if (res.error) {
        throw new Error(`Resend error: ${res.error.message || 'Unknown error'}`);
    }

    return res;
};

module.exports = sendEmail;