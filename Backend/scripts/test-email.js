const dns = require('dns');
// Force IPv4
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const nodemailer = require('nodemailer');

const testEmail = async () => {
    console.log('--- Bắt đầu kiểm tra gửi email ---');
    console.log('Email:', process.env.SMTP_EMAIL);
    // Chỉ hiện 4 ký tự đầu của password để bảo mật
    console.log('Password:', process.env.SMTP_PASSWORD ? process.env.SMTP_PASSWORD.substring(0, 4) + '...' : 'Chưa cấu hình');

    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
        console.error('LỖI: Thiếu cấu hình SMTP_EMAIL hoặc SMTP_PASSWORD trong .env');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.googlemail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });

    // // Thử cấu hình thủ công để debug lỗi DNS
    // const transporter = nodemailer.createTransport({
    //     host: '64.233.187.108', // IP từ ping smtp.gmail.com
    //     port: 465,
    //     secure: true,
    //     auth: {
    //         user: process.env.SMTP_EMAIL,
    //         pass: process.env.SMTP_PASSWORD
    //     },
    //     tls: {
    //         rejectUnauthorized: false // Bỏ qua lỗi chứng chỉ do dùng IP
    //     }
    // });

    try {
        // 1. Kiểm tra kết nối SMTP
        console.log('Đang kiểm tra kết nối đến Gmail...');
        await transporter.verify();
        console.log('✅ Kết nối SMTP thành công!');

        // 2. Gửi thử email
        console.log('Đang gửi email thử nghiệm...');
        const info = await transporter.sendMail({
            from: `Test Script <${process.env.SMTP_EMAIL}>`,
            to: process.env.SMTP_EMAIL, // Gửi cho chính mình
            subject: 'Test Email Chess Game',
            text: 'Nếu bạn nhận được email này, hệ thống gửi mail hoạt động bình thường.'
        });

        console.log('✅ Gửi email thành công!');
        console.log('Message ID:', info.messageId);

    } catch (error) {
        console.error('❌ CÓ LỖI XẢY RA:');
        console.error(error);
        
        if (error.code === 'EAUTH') {
            console.log('\n--- GỢI Ý KHẮC PHỤC ---');
            console.log('Lỗi xác thực. Hãy kiểm tra:');
            console.log('1. Email trong .env có đúng không?');
            console.log('2. Mật khẩu ứng dụng (App Password) có đúng không?');
            console.log('3. Thử xóa khoảng trắng trong SMTP_PASSWORD ở file .env (ví dụ: "abcd efgh" -> "abcdefgh")');
        }
    }
};

testEmail();
