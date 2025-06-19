import { useState, useEffect } from "react";
import { Form, useNavigate, useActionData, useNavigation } from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticator } from "../utils/auth.server";
import { createUserSession} from "../utils/session.server";
import image from "../foto/pngwing.com(6).png";

// Loader Function
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (user) return redirect('/');
  return null;
}

// Action Function
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const user = await authenticator.authenticate("form", request, {
      successRedirect: "/",
      failureRedirect: "/login",
    });

    if (user.role !== "ADMIN"){
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    return createUserSession(user.id, "/");
  } catch (error) {
    if (error instanceof Response) {
      throw error; // Tangani redirect jika menggunakan failureRedirect
    } else if (error instanceof Error) {
      console.log("Error:", error.message); // Debugging log
      
      // Check for specific authentication errors
      if (error.message.includes("Invalid credentials") || 
          error.message.includes("User not found") ||
          error.message.includes("Incorrect password") ||
          error.message.includes("Authentication failed")) {
        return json({ error: "InvalidCredentials" }, { status: 401 });
      }
      
      return json({ error: error.message }, { status: 401 });
    } else {
      return json({ error: "Unknown error" }, { status: 401 });
    }
  }
};

// Login Component
const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [inputErrors, setInputErrors] = useState({
    login: false,
    password: false
  });
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.error && !isSubmitting) {
      setShowErrorPopup(true);
      
      // Highlight input fields when there's an error
      if (actionData.error === "InvalidCredentials") {
        setInputErrors({
          login: true,
          password: true
        });
      } else {
        setInputErrors({
          login: true,
          password: true
        });
      }
    } else {
      // Reset input errors if no error
      setInputErrors({
        login: false,
        password: false
      });
    }
  }, [actionData?.error, isSubmitting]);

  const togglePasswordVisibility = () => {
    setShowPassword((prevState) => !prevState);
  };

  const handleInputChange = () => {
    // Reset input errors when user starts typing
    if (inputErrors.login || inputErrors.password) {
      setInputErrors({
        login: false,
        password: false
      });
    }
  };

  const closeErrorPopup = () => {
    setShowErrorPopup(false);
  };

  const getErrorMessage = () => {
    switch (actionData?.error) {
      case "Unauthorized":
        return "Anda tidak memiliki akses admin. Silakan gunakan akun admin yang valid.";
      case "InvalidCredentials":
        return "Username atau password yang Anda masukkan salah. Silakan periksa kembali dan coba lagi.";
      default:
        return actionData?.error || "Terjadi kesalahan saat login. Silakan coba lagi.";
    }
  };

  const getErrorTitle = () => {
    switch (actionData?.error) {
      case "Unauthorized":
        return "Akses Ditolak";
      case "InvalidCredentials":
        return "Login Gagal";
      default:
        return "Terjadi Kesalahan";
    }
  };

  const getErrorIcon = () => {
    switch (actionData?.error) {
      case "Unauthorized":
        return (
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        );
      case "InvalidCredentials":
        return (
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"></path>
          </svg>
        );
      default:
        return (
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        );
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center w-full max-w-md p-4">
        <div className="mb-8">
          <i className="fas fa-user-circle text-9xl text-gray-400"></i>
        </div>
        <h1 className="text-2xl font-bold mb-6">Login Account</h1>

        <Form action="/login" method="post" className="w-full">
          <div className={`flex items-center border rounded-lg p-2 mb-4 transition-colors duration-200 ${
            inputErrors.login 
              ? 'border-red-500 bg-red-50' 
              : 'border-black hover:border-gray-600 focus-within:border-blue-500'
          }`}>
            <i className={`fa fa-user mr-2 ${inputErrors.login ? 'text-red-500' : 'text-gray-400'}`}></i>
            <input
              type="text"
              name="login"
              placeholder="Email/Username"
              required
              disabled={isSubmitting}
              onChange={handleInputChange}
              className={`flex-1 outline-none disabled:bg-gray-100 ${
                inputErrors.login 
                  ? 'text-red-700 placeholder-red-400 bg-red-50' 
                  : 'text-gray-500'
              }`}
            />
          </div>
          
          <div className={`flex items-center border rounded-lg p-2 mb-2 transition-colors duration-200 ${
            inputErrors.password 
              ? 'border-red-500 bg-red-50' 
              : 'border-black hover:border-gray-600 focus-within:border-blue-500'
          }`}>
            <i className={`fas fa-lock mr-2 ${inputErrors.password ? 'text-red-500' : 'text-gray-400'}`}></i>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              required
              placeholder="Password"
              disabled={isSubmitting}
              onChange={handleInputChange}
              className={`flex-1 outline-none disabled:bg-gray-100 ${
                inputErrors.password 
                  ? 'text-red-700 placeholder-red-400 bg-red-50' 
                  : 'text-gray-500'
              }`}
            />
            <button
              type="button"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              className="focus:outline-none ml-2"
              onClick={togglePasswordVisibility}
              disabled={isSubmitting}
              tabIndex={0}
            >
              <i
                className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"} ${
                  inputErrors.password ? 'text-red-500' : 'text-gray-400'
                }`}
                aria-hidden="true"
              ></i>
            </button>
          </div>

          {/* Inline error message */}
          {actionData?.error && !showErrorPopup && (
            <div className="text-red-600 text-sm mb-3 p-2 bg-red-50 border border-red-200 rounded flex items-center">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              <span>{getErrorMessage()}</span>
            </div>
          )}

          <button
            type="button"
            className="float-right mb-2 text-gray-300 hover:text-gray-500 disabled:pointer-events-none"
            onClick={() => navigate("/forgot-password")}
            disabled={isSubmitting}
          >
            Lupa sandi ?
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-yellow-300 text-black font-bold py-2 rounded-lg mb-6 shadow-lg hover:bg-yellow-400 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Memproses...
              </div>
            ) : (
              "Login"
            )}
          </button>
        </Form>

        <Form action="/auth/google" method="post" className="w-full">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white text-black font-bold py-2 rounded-lg mb-6 shadow-lg flex items-center justify-center space-x-2 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <img src={image} alt="Google Logo" className="w-5 h-5" />
            <span>Login dengan Google</span>
          </button>
        </Form>

        <div className="text-center mb-4">
          <span className="text-gray-500">Belum terdaftar? </span>
          <button
            type="button"
            onClick={() => navigate("/register")}
            disabled={isSubmitting}
            className="text-yellow-300 font-bold underline hover:text-yellow-400 disabled:pointer-events-none"
          >
            Buat akun
          </button>
        </div>
        <div className="text-center text-gray-500">
          <p>
            Copyright <i className="far fa-copyright"></i> 2024 ThriftEase
          </p>
        </div>

        {/* Enhanced Error Popup with specific handling for Invalid Credentials */}
        {showErrorPopup && actionData?.error && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white border-2 border-red-600 p-6 rounded-lg w-80 max-w-sm mx-4 text-center shadow-2xl">
              <div className="text-red-600 mb-4">
                {getErrorIcon()}
              </div>
              <h2 className="text-xl font-semibold text-red-600 mb-2">
                {getErrorTitle()}
              </h2>
              <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                {getErrorMessage()}
              </p>
              
              <div className="flex flex-col space-y-2">
                {actionData.error === "InvalidCredentials" ? (
                  <>
                    <button
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors duration-200"
                      onClick={closeErrorPopup}
                    >
                      Coba Lagi
                    </button>
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
                      onClick={() => {
                        setShowErrorPopup(false);
                        navigate("/forgot-password");
                      }}
                    >
                      Lupa Password?
                    </button>
                  </>
                ) : actionData.error === "Unauthorized" ? (
                  <>
                    <button
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors duration-200"
                      onClick={closeErrorPopup}
                    >
                      Coba Lagi
                    </button>
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
                      onClick={() => {
                        setShowErrorPopup(false);
                        navigate("/login"); // Navigate to regular user login
                      }}
                    >
                      Login sebagai User
                    </button>
                  </>
                ) : (
                  <button
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors duration-200"
                    onClick={closeErrorPopup}
                  >
                    Tutup
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;