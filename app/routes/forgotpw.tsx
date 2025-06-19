import { useState, useEffect } from 'react';

export default function VerifyOtpPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [isOtpSent, setIsOtpSent] = useState(false);

  useEffect(() => {
    if (timer > 0 && isOtpSent) {
      const interval = setInterval(() => {
        setTimer(prevTimer => prevTimer - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer, isOtpSent]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/sendOtp?email=${email}`);
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setMessage('OTP telah dikirim ke email Anda.');
        setIsOtpSent(true);
        setTimer(60);
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mengirim OTP');
    }
  };

  const handleSendOtp = () => {
    const fakeEvent = {
      preventDefault: () => {}
    } as React.FormEvent<HTMLFormElement>;
    handleSubmit(fakeEvent);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="text-center max-w-md w-full px-4">
        {!isOtpSent && (
          <>
            <h1 className="text-2xl font-bold mb-6">Verifikasi Email Anda</h1>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-left mb-2 font-medium">
                  Email:
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-300"
                  placeholder="Masukkan email Anda"
                />
              </div>
              <button
                onClick={handleSendOtp}
                className="w-full bg-yellow-300 text-black py-2 px-4 rounded shadow-md hover:shadow-lg font-bold hover:bg-yellow-400 transition-colors"
              >
                Kirim OTP
              </button>
            </div>
            {message && <p className="mt-4 text-green-500">{message}</p>}
            {error && <p className="mt-4 text-red-500">{error}</p>}
          </>
        )}

        {isOtpSent && (
          <div>
            <h1 className="text-2xl font-bold mb-4">OTP Berhasil Dikirim</h1>
            <p className="text-gray-600 mb-4">
              OTP telah dikirim ke email: <strong>{email}</strong>
            </p>
            {timer > 0 ? (
              <p className="text-blue-500">
                Kirim ulang OTP dalam {timer} detik
              </p>
            ) : (
              <button
                onClick={() => {
                  setIsOtpSent(false);
                  setTimer(60);
                  setMessage('');
                  setError('');
                }}
                className="text-yellow-600 hover:text-yellow-800 font-medium underline"
              >
                Kirim Ulang OTP
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}