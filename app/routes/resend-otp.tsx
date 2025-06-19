import { ActionFunction, json } from "@remix-run/node";
import { resendOTP } from "~/utils/jwt.server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Inisialisasi rate limiter
const rateLimiter = new RateLimiterMemory({
  points: 3, // Maksimal 3 permintaan
  duration: 60, // Dalam durasi 60 detik (1 menit)
});

export const action: ActionFunction = async ({ request }) => {
  try {
    const formData = await request.json();
    const email = formData.email;

    // Validasi format email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return json({ success: false, error: "Format email tidak valid." }, { status: 400 });
    }

    // Rate limiting berdasarkan email
    await rateLimiter.consume(email);

    // Periksa apakah email pengguna terdaftar
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return json({ success: false, error: "Email tidak ditemukan." }, { status: 404 });
    }

    // Kirim ulang OTP
    const { token } = await resendOTP(email);

    return json({
      success: true,
      message: "OTP baru telah dikirim ke email Anda. Harap periksa kotak masuk Anda.",
      token
    });
  } catch (rateLimiterRes) {
    if (
      typeof rateLimiterRes === "object" &&
      rateLimiterRes !== null &&
      "msBeforeNext" in rateLimiterRes
    ) {
      const msBeforeNext = (rateLimiterRes as { msBeforeNext: number }).msBeforeNext;
      const retrySecs = Math.ceil(msBeforeNext / 1000);
      return json({
        success: false,
        error: `Tunggu ${retrySecs} detik sebelum meminta OTP lagi.`,
      }, { status: 429 });
    }

    console.error("Error saat mengirim ulang OTP:", rateLimiterRes);
    return json({
      success: false,
      error: "Gagal mengirim ulang OTP. Silakan coba lagi nanti.",
    }, { status: 500 });
  }
};