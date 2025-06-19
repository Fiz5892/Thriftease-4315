import image from "../foto/check_15526401 1.png";
import { useNavigate } from "@remix-run/react";

const SuccessGantiPasswordPage = () => {
    const navigate = useNavigate();

    return (
        <div className="flex items-center justify-center min-h-screen bg-white">
            <div className="text-center p-4">
                <p className="text-black text-base mb-6">
                    Kata sandi baru Anda telah berhasil disimpan. Silakan gunakan kata
                    sandi ini untuk masuk ke akun Anda.
                </p>
                <div className="flex justify-center mb-6">
                    <img src={image} alt="Illustration" className="mx-auto mb-4" />
                </div>
                <button
                className="w-full bg-yellow-300 text-black py-2 px-4 rounded shadow-md hover:shadow-lg font-bold"
                onClick={() => navigate("/login")}
                >
                    Kembali ke Menu Login
                </button>
            </div>
        </div>
    );
};

export default SuccessGantiPasswordPage;