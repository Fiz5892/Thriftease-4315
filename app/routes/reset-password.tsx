import { useState } from 'react';
import { useSearchParams, useNavigate, useActionData, useNavigation, Form } from '@remix-run/react';
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { prisma } from '../utils/prisma.server';
import bcrypt from 'bcryptjs';

// Server-side action untuk menangani reset password
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const token = formData.get('token') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!token || !newPassword || !confirmPassword) {
    return json({ 
      error: 'Token, password baru, dan konfirmasi password harus diisi.',
      success: false 
    }, { status: 400 });
  }

  // Validasi password minimal 6 karakter
  if (newPassword.length < 6) {
    return json({ 
      error: 'Password harus minimal 6 karakter.',
      success: false 
    }, { status: 400 });
  }

  // Validasi konfirmasi password
  if (newPassword !== confirmPassword) {
    return json({ 
      error: 'Password dan konfirmasi password tidak sama.',
      success: false 
    }, { status: 400 });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiresAt: { gte: new Date() }, // Token masih berlaku
      },
    });

    if (!user) {
      return json({ 
        error: 'Token tidak valid atau telah kedaluwarsa.',
        success: false 
      }, { status: 400 });
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user dengan password baru dan hapus token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    return json({ 
      message: 'Password berhasil direset. Anda akan diarahkan ke halaman login.',
      success: true 
    });
  } catch (error) {
    console.error('Error during password reset:', error);
    return json({ 
      error: 'Terjadi kesalahan saat mereset password.',
      success: false 
    }, { status: 500 });
  }
}

// Client-side React component untuk halaman reset password
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  const token = searchParams.get('token');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  // Redirect ke login jika berhasil
  if (actionData?.success) {
    setTimeout(() => navigate('/login'), 3000);
  }

  // Jika tidak ada token, tampilkan error
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-full max-w-xs mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Reset Password</h1>
          <div className="text-red-500">Token tidak valid atau tidak ditemukan.</div>
          <button 
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Kembali ke Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="w-full max-w-xs mx-auto">
        <h1 className="text-2xl font-bold text-center mb-4">Reset Password</h1>
        
        {actionData && 'error' in actionData && actionData.error && (
          <div className="text-red-500 text-center mb-4 p-3 bg-red-100 rounded">
            {actionData.error}
          </div>
        )}
        
        {actionData?.success && 'message' in actionData && actionData.message && (
          <div className="text-green-500 text-center mb-4 p-3 bg-green-100 rounded">
            {actionData.message}
          </div>
        )}

        {!actionData?.success && (
          <Form method="post" className="space-y-6">
            {/* Hidden token field */}
            <input type="hidden" name="token" value={token} />
            
            <div>
              <label className="block text-sm font-bold mb-2" htmlFor="newPassword">
                Password Baru
              </label>
              <div className="relative">
                <input
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  type={showPassword ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  required
                  minLength={6}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer bg-transparent border-none focus:outline-none"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  tabIndex={0}
                >
                  <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-bold mb-2" htmlFor="confirmPassword">
                Konfirmasi Password
              </label>
              <div className="relative">
                <input
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                  minLength={6}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer bg-transparent border-none focus:outline-none"
                  onClick={toggleConfirmPasswordVisibility}
                  aria-label={showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"}
                  tabIndex={0}
                >
                  <i className={`fas ${showConfirmPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                </button>
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full p-3 bg-yellow-300 text-black font-bold rounded shadow-md hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Memproses...' : 'Reset Password'}
            </button>
          </Form>
        )}

        {actionData?.success && (
          <div className="text-center mt-4">
            <button 
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Lanjut ke Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}