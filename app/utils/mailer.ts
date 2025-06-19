import nodemailer from 'nodemailer';

// Membuat transporter untuk mengirim email
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465, // Gunakan port 465 untuk SSL atau 587 untuk TLS
  secure: true, // true untuk port 465, false untuk port 587
  auth: {
     user: process.env.EMAIL_USER,
     pass: process.env.EMAIL_PASS     
  },
});

export default transporter;