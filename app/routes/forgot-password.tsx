import { useState } from 'react';
import image from "../foto/img2.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setMessage(errorData.error || 'An error occurred');
      } else {
        setMessage('Check your email for reset instructions.');
      }
    } catch (error) {
      setMessage('An unexpected error occurred');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="bg-white p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">Pemulihan Akun</h1>
      <img src={image} alt="Illustration" className="mx-auto mb-4" />
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          className="w-full p-3 border border-gray-300 rounded mb-4"

        />
        <button type="submit" className="w-full p-3 bg-yellow-300 text-black font-bold rounded shadow-md hover:bg-yellow-400" >Send Reset Link</button>
      </form>
      {message && <p>{message}</p>}
    </div>
    </div>
  );
}