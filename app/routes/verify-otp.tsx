import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from '@remix-run/react';
import { json, redirect } from '@remix-run/node';
import { verifyOTP } from '~/utils/jwt.server';

export const action = async ({ request }: { request: Request }) => {
  const body = await request.json();
  const { otpInput, token } = body;

  if (!otpInput || otpInput.length !== 4) {
    return json({ success: false, message: 'Kode OTP harus terdiri dari 4 digit.' }, { status: 400 });
  }
  if (!token) {
    return json({ success: false, message: 'Token tidak valid.' }, { status: 400 });
  }

  const isVerified = await verifyOTP(token, otpInput);

  if (isVerified) {
    json({ success: true }, { status: 200 });
    setTimeout(() => {
      redirect('/');
    }, 2000);
  } else {
    return json({ success: false, message: 'OTP tidak valid.' }, { status: 400 });
  }

  // Removed unreachable and undefined 'error' variable check

  return json({ success: false, message: 'Terjadi kesalahan internal. Silakan coba lagi nanti.' }, { status: 500 });
}

const VerifyOTP = () => {
  const [otpInput, setOtpInput] = useState(Array(4).fill('')); // Array untuk OTP 4 digit
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [error, setError] = useState('');
  const [showErrorPopup, setShowErrorPopup] = useState(false); // State untuk pop-up error
  const [successMessage, setSuccessMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // Default waktu 5 menit
  const [searchParams] = useSearchParams();

  const [token, setToken] = useState(searchParams.get('token'));
  const email = searchParams.get('email');

  const navigate = useNavigate();

  useEffect(() => {
    if (timeLeft <= 0) {
      setIsExpired(true);
      setError('OTP telah kedaluwarsa. Silakan minta OTP baru.');
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return; // Izinkan hanya angka
    const newOtpInput = [...otpInput];
    newOtpInput[index] = value;
    setOtpInput(newOtpInput);

    if (value && index < otpInput.length - 1) {
      if (inputsRef.current[index + 1]) {
        inputsRef.current[index + 1]?.focus(); // Pindah ke input berikutnya
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otpInput[index] && index > 0) {
      if (inputsRef.current[index - 1]) {
        inputsRef.current[index - 1]?.focus(); // Pindah ke input sebelumnya
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const otp = otpInput.join('');
    if (!otp || otp.length < 4) {
      setError('Kode OTP harus terdiri dari 4 digit.');
      setShowErrorPopup(true); // Tampilkan pop-up
      return;
    }

    if (!token) {
      setError('Token tidak ditemukan. Silakan coba lagi.');
      setShowErrorPopup(true); // Tampilkan pop-up
      return;
    }

    const response = await fetch('/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ otpInput: otp, token }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    console.log(result);

    if (result.success) {
      setSuccessMessage('OTP berhasil diverifikasi.');
      setTimeout(() => {
        window.location.href = '/'; // Redirect ke halaman utama
      }, 2000); // Tunda redirect
    } else {
      setError(result.message || 'OTP tidak valid.');
      setShowErrorPopup(true); // Tampilkan pop-up
    }
  };

  const resendOTP = async () => {
    if (!email) {
      setError('Email tidak ditemukan. Silakan coba lagi.');
      return;
    }

    setIsResending(true);
    setSuccessMessage('');
    setError('');

    try {
      const response = await fetch('/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();
      if (result.success) {
        setToken(result.token);
        setSuccessMessage('OTP baru telah dikirim ke email Anda.');
        setTimeLeft(300); // Reset timer ke 5 menit
        setIsExpired(false); // Reset status kedaluwarsa
      } else {
        setError(result.error || 'Gagal mengirim ulang OTP.');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat mengirim ulang OTP. Silakan coba lagi.');
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Verifikasi OTP</h1>
        <p className="text-gray-600 mb-4">
          Masukkan Kode Verifikasi yang Baru Saja Kami Kirimkan ke Alamat Email Anda
        </p>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        {successMessage && <div className="text-green-500 mb-4">{successMessage}</div>}
        <form onSubmit={handleSubmit}>
          <div className="flex justify-center space-x-2 mb-4">
            {otpInput.map((digit, index) => (
              <input
                key={index}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="w-12 h-12 border border-gray-300 text-center text-xl"
                ref={(el) => (inputsRef.current[index] = el)}
              />
            ))}
          </div>
          <div className="text-xl font-bold mb-4">{formatTime(timeLeft)}</div>
          <p className="text-gray-600 mb-4">
            Jika Anda tidak mendapatkan kode,{' '}
            <span
              className={`text-yellow-300 cursor-pointer ${isResending || isExpired ? 'opacity-50' : ''
                }`}
              onClick={!isResending && !isExpired ? resendOTP : undefined}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isResending && !isExpired) {
                  resendOTP();
                }
              }}
              tabIndex={0}
              role="button"
              aria-disabled={isResending || isExpired}
            >
              Kirim Ulang
            </span>
          </p>
          <button
            type="submit"
            disabled={isExpired}
            className={`w-full bg-yellow-300 text-black py-2 px-4 rounded shadow-md hover:shadow-lg font-bold ${isExpired ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            onClick={() => setTimeout(() => {
              navigate('/');
            }, 2000)}
          >
            Konfirmasi OTP
          </button>
        </form>
      </div>
      {/* Pop-up Error */}
      {showErrorPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white border-2 border-red-600 p-6 rounded-lg w-80 text-center">
            <div className="text-red-600 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-red-600 mb-2">Verifikasi Gagal</h2>
            <p className="text-gray-600">{error || 'Terjadi kesalahan saat verifikasi.'}</p>
            <button
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded"
              onClick={() => setShowErrorPopup(false)}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerifyOTP;