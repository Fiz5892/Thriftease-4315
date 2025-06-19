import transporter from './mailer'; // Import mail transporter (mailer setup)
import crypto from 'crypto'; // Generate OTP and secure tokens
import jwt from 'jsonwebtoken'; // Manage JWT tokens
import { PrismaClient } from '@prisma/client'; // Prisma ORM for database operations

// Inisialisasi Prisma Client
const prisma = new PrismaClient();

// Ambil JWT Secret Key dari environment variables
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY!;
if (!JWT_SECRET_KEY) {
  throw new Error('JWT_SECRET_KEY tidak ditemukan di environment variables!');
}

// Helper: Generate random 4-digit OTP
const generateOTP = (): string => crypto.randomInt(1000, 9999).toString();

// Helper: Generate JWT with custom payload
const generateJWT = (payload: object, expiresIn: string): string => {
  return jwt.sign(payload, JWT_SECRET_KEY, { expiresIn });
};

// Helper: Send email with the provided options
const sendEmail = async (to: string, subject: string, text: string): Promise<void> => {
  const mailOptions = {
    from: process.env.EMAIL_USER, // Alamat pengirim dari konfigurasi mailer
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email terkirim ke: ${to}`);
  } catch (error) {
    console.error(`Gagal mengirim email ke ${to}:`, error);
    throw new Error('Pengiriman email gagal, mohon coba lagi nanti.');
  }
};

// Function: Send OTP via Email
const sendOTP = async (email: string): Promise<{ token: string; expiresIn: number }> => {
  const otp = generateOTP();
  const token = generateJWT({ otp, email }, '5m'); // Token OTP berlaku selama 5 menit
  const expiresIn = 300; // 5 minutes in seconds

  try {
    await sendEmail(email, 'Kode OTP ThriftEase', `Kode OTP Kamu adalah: ${otp}`);
  } catch (error) {
    throw new Error('Gagal mengirim OTP. Pastikan email valid dan coba lagi.');
  }

  return { token, expiresIn };
};

// Function: Resend OTP (Reuse sendOTP logic)
const resendOTP = async (email: string): Promise<{ token: string; expiresIn: number }> => {
  return sendOTP(email);
};

// Function: Verify OTP
const attempts = new Map<string, number>(); // Map untuk melacak jumlah percobaan

const verifyOTP = async (token: string, otpInput: string): Promise<boolean> => {
  try {
    const { otp, email } = jwt.verify(token, JWT_SECRET_KEY) as { otp: string; email: string };

    // Cek apakah email melebihi batas maksimal percobaan
    if (!attempts.has(email)) attempts.set(email, 0);

    if (attempts.get(email)! >= 3) {
      throw new Error('Terlalu banyak kesalahan, mohon coba lagi nanti.');
    }

    // Validasi OTP
    if (otp === otpInput) {
      attempts.delete(email); // Reset percobaan jika sukses
      console.log('OTP Valid!');
      await prisma.user.update({
        where: { email },
        data: { isVerified: true }, // Tandai pengguna sebagai terverifikasi
      });
      return true;
    }

    // Tambahkan percobaan jika OTP salah
    attempts.set(email, attempts.get(email)! + 1);
    console.log('OTP Tidak Valid!');
    return false;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error('Token kedaluwarsa:', error);
      throw new Error('Token OTP telah kedaluwarsa.');
    } else {
      console.error('Token tidak valid:', error);
      throw new Error('Token atau kode OTP tidak valid.');
    }
  }
};

// Function: Send Password Reset Email
const sendResetEmail = async (email: string, token: string): Promise<void> => {
  const resetUrl = `https://thriftease.vercel.app/reset-password?token=${token}`;
  const mailOptions = {
    from: process.env.EMAIL_USER, // Alamat pengirim dari konfigurasi mailer
    to: email,
    subject: 'Reset Password ThriftEase',
    text: `Klik tautan berikut untuk mereset password Anda: ${resetUrl}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email reset password terkirim ke: ${email}`);
  } catch (error) {
    console.error(`Gagal mengirim email reset password ke ${email}:`, error);
    throw new Error('Pengiriman email reset password gagal.');
  }
};

// Function: Verify Password Reset Token
const verifyResetToken = async (token: string): Promise<{ email: string }> => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_KEY) as { email: string };
    return { email: decoded.email };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error('Token reset password kedaluwarsa:', error);
      throw new Error('Token reset password telah kedaluwarsa.');
    } else {
      console.error('Token reset password tidak valid:', error);
      throw new Error('Token reset password tidak valid.');
    }
  }
};

// Exports
export { sendOTP, resendOTP, verifyOTP, sendResetEmail, verifyResetToken };
