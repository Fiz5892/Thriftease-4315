import midtransClient from 'midtrans-client';

export const snap = new midtransClient.Snap({
  isProduction: false, // Ubah ke `true` untuk produksi
  serverKey: process.env.MIDTRANS_SERVER_KEY as string,
  clientKey: process.env.MIDTRANS_CLIENT_KEY as string,
});
