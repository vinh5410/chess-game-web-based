const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
    console.error('RESEND_API_KEY is not set. Email sending will fail.');
}

const resend = apiKey ? new Resend(apiKey) : null;

/**
 * options: { email, subject, message }
 */
const sendEmail = async ({ email, subject, message }) => {
    if (!resend) {
        throw new Error('RESEND_API_KEY is missing');
    }

    const from = process.env.FROM_EMAIL || 'no-reply@your-domain.com'; // phải là sender đã verify bên Resend

    const res = await resend.emails.send({
        from,
        to: email,
        subject,
        text: message
    });

    if (res.error) {
        throw new Error(`Resend error: ${res.error.message || 'Unknown error'}`);
    }

    return res;
};

module.exports = sendEmail;