import React from 'react';

// Basic Spinning Loader
export const SpinningLoader = ({ size = "medium", color = "yellow" }: { 
  size?: "small" | "medium" | "large" | "xl"; 
  color?: "yellow" | "blue" | "green" | "red" | "purple" | "white";
}) => {
  const sizeClasses = {
    small: "w-4 h-4 border-2",
    medium: "w-8 h-8 border-4", 
    large: "w-12 h-12 border-4",
    xl: "w-16 h-16 border-4"
  };

  const colorClasses = {
    yellow: "border-yellow-200 border-t-yellow-500",
    blue: "border-blue-200 border-t-blue-500",
    green: "border-green-200 border-t-green-500", 
    red: "border-red-200 border-t-red-500",
    purple: "border-purple-200 border-t-purple-500",
    white: "border-gray-300 border-t-white"
  };

  return (
    <div className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-spin`}></div>
  );
};

// Double Ring Spinner
export const DoubleRingSpinner = ({ size = "medium" }: { size?: "small" | "medium" | "large" }) => {
  const sizeClasses = {
    small: "w-6 h-6",
    medium: "w-10 h-10",
    large: "w-14 h-14"
  };

  return (
    <div className={`${sizeClasses[size]} relative`}>
      <div className="absolute inset-0 border-4 border-yellow-200 rounded-full animate-spin"></div>
      <div className="absolute inset-1 border-4 border-t-yellow-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '0.75s'}}></div>
    </div>
  );
};

// Pulsing Dot Spinner
export const PulsingDots = () => {
  return (
    <div className="flex space-x-1">
      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
    </div>
  );
};

// Rotating Squares
export const RotatingSquares = ({ size = "medium" }: { size?: "small" | "medium" | "large" }) => {
  const sizeClasses = {
    small: "w-6 h-6",
    medium: "w-10 h-10", 
    large: "w-14 h-14"
  };

  return (
    <div className={`${sizeClasses[size]} relative`}>
      <div className="absolute inset-0 border-2 border-yellow-400 animate-spin" style={{animationDuration: '1.5s'}}></div>
      <div className="absolute inset-2 border-2 border-yellow-600 animate-spin" style={{animationDuration: '1s', animationDirection: 'reverse'}}></div>
    </div>
  );
};

// Gradient Ring Spinner  
export const GradientRingSpinner = ({ size = "medium" }: { size?: "small" | "medium" | "large" }) => {
  const sizeClasses = {
    small: "w-6 h-6",
    medium: "w-10 h-10",
    large: "w-14 h-14"
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full animate-spin`} 
         style={{
           background: 'conic-gradient(from 0deg, #fbbf24, #f59e0b, #d97706, transparent)',
           padding: '2px'
         }}>
      <div className="w-full h-full bg-white rounded-full"></div>
    </div>
  );
};

// Orbit Spinner
export const OrbitSpinner = ({ size = "medium" }: { size?: "small" | "medium" | "large" }) => {
  const sizeClasses = {
    small: "w-8 h-8",
    medium: "w-12 h-12",
    large: "w-16 h-16"
  };

  return (
    <div className={`${sizeClasses[size]} relative animate-spin`}>
      <div className="absolute top-0 left-1/2 w-2 h-2 bg-yellow-500 rounded-full transform -translate-x-1/2"></div>
      <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-yellow-400 rounded-full transform -translate-x-1/2"></div>
      <div className="absolute left-0 top-1/2 w-2 h-2 bg-yellow-300 rounded-full transform -translate-y-1/2"></div>
      <div className="absolute right-0 top-1/2 w-2 h-2 bg-yellow-600 rounded-full transform -translate-y-1/2"></div>
    </div>
  );
};

// Loading dengan Text
export const SpinnerWithText = ({ 
  text = "Loading...", 
  size = "medium" 
}: { 
  text?: string; 
  size?: "small" | "medium" | "large";
}) => {
  return (
    <div className="flex flex-col items-center space-y-3">
      <SpinningLoader size={size} color="yellow" />
      <p className="text-gray-600 text-sm font-medium animate-pulse">{text}</p>
    </div>
  );
};

// Full Screen Loading Overlay
export const LoadingOverlay = ({ 
  isVisible, 
  text = "Memuat...",
  blur = true 
}: { 
  isVisible: boolean; 
  text?: string;
  blur?: boolean;
}) => {
  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 ${blur ? 'backdrop-blur-sm' : ''}`}>
      <div className="bg-white rounded-lg p-8 shadow-2xl">
        <SpinnerWithText text={text} size="large" />
      </div>
    </div>
  );
};

// Button dengan Loading
export const LoadingButton = ({ 
  isLoading, 
  onClick, 
  children, 
  className = "",
  disabled = false 
}: {
  isLoading: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`relative flex items-center justify-center px-4 py-2 rounded-lg transition-all duration-200 ${
        isLoading || disabled 
          ? 'bg-gray-300 cursor-not-allowed' 
          : 'bg-yellow-500 hover:bg-yellow-600 active:scale-95'
      } ${className}`}
    >
      {isLoading ? (
        <>
          <SpinningLoader size="small" color="white" />
          <span className="ml-2 text-white">Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};