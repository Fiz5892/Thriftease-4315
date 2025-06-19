// components/ErrorPopup.tsx
import React from 'react';

type ErrorPopupProps = {
  message: string | null;
  onClose: () => void;
};

const ErrorPopup: React.FC<ErrorPopupProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg max-w-sm text-center">
        <p className="text-red-600 font-bold">{message}</p>
        <button
          onClick={onClose}
          className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};

export default ErrorPopup;