import { json, type DataFunctionArgs  } from '@remix-run/node';
import { prisma } from '../utils/prisma.server'; // Prisma client
import { sendResetEmail } from '../utils/jwt.server'; // Fungsi untuk mengirim email reset
import crypto from 'crypto';

// Function: POST untuk menghandle permintaan forgot password
export async function action({ request }: DataFunctionArgs ) {
  // Parsing data dari request
  const body = await request.json();
  const email = body.email;

  if (!email) {
    return json({ error: 'Email harus diisi.' }, { status: 400 });
  }

  // Cari user berdasarkan email
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return json({ error: 'Email tidak ditemukan.' }, { status: 404 });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenExpiry = new Date(Date.now() + 3600000); // Berlaku selama 1 jam

  try {
    // Simpan token dan expiry ke database
    await prisma.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiresAt: tokenExpiry,
      },
    });

    // Kirim email dengan tautan reset
    await sendResetEmail(email, resetToken);

    return json({ message: 'Email reset password telah dikirim. Periksa kotak masuk Anda.' }, { status: 200 });
  } catch (error) {
    console.error('Gagal mengirim email reset password:', error);
    return json({ error: 'Terjadi kesalahan saat memproses permintaan. Silakan coba lagi.' }, { status: 500 });
  }
}
