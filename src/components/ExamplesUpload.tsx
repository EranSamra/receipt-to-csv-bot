import { useState } from "react";
import { FolderOpen } from "lucide-react";

interface ExamplesUploadProps {
  onOpenModal: () => void;
  isProcessing: boolean;
}

export const ExamplesUpload = ({ onOpenModal, isProcessing }: ExamplesUploadProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => { if (!isProcessing) onOpenModal(); }}
      className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 md:p-12 text-center mesh-transition cursor-pointer ${
        isHovered
          ? "border-gray-400 bg-gray-50 scale-[1.02] mesh-shadow-lg"
          : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
      }`}
      role="button"
      aria-label="Browse sample receipts"
      tabIndex={0}
      onKeyDown={(e) => { if (!isProcessing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenModal(); } }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-4 left-4 w-8 h-8 bg-gray-500 rounded-full"></div>
        <div className="absolute top-8 right-8 w-6 h-6 bg-gray-600 rounded-full"></div>
        <div className="absolute bottom-6 left-8 w-4 h-4 bg-gray-700 rounded-full"></div>
      </div>

      {/* Example Chip/Badge */}
      <div className="absolute -top-2 -right-2 z-10">
        <span className="inline-flex items-center px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md">
          <span className="hidden sm:inline">Example - See how it works</span>
          <span className="sm:hidden">Example</span>
        </span>
      </div>

      <div className="relative">
        {/* Examples Icon */}
        <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 mesh-float">
          <FolderOpen className="h-8 w-8 sm:h-10 sm:w-10 text-gray-600" />
        </div>

        {/* Main Text */}
        <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mb-2 sm:mb-3">
          Select Examples
        </h3>
        
        <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base md:text-lg px-2">
          Load sample receipts to test the extraction
        </p>

        {/* Clickable Hint */}
        <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base md:text-lg px-2">
          Click to browse sample receipts
        </p>
      </div>
    </div>
  );
};
