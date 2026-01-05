const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const sendEmail = require('../utils/sendEmail');

const testIntegration = async () => {
    console.log('--- Test Integration sendEmail ---');
    console.log('Email:', process.env.SMTP_EMAIL);
    
    try {
        console.log('Attempting to send email via sendEmail module...');
        await sendEmail({
            email: process.env.SMTP_EMAIL, // Send to self
            subject: 'Integration Test',
            message: 'This is a test from the integration script.'
        });
        console.log('✅ Email sent successfully!');
    } catch (error) {
        console.error('❌ Failed to send email:');
        console.error(error);
    }
};

testIntegration();