import { useCallback, useState, useRef } from "react";
import { Upload, X, FileText, Image, File, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ReceiptUploadProps {
  onFilesSelected: (files: File[]) => void;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  onClearFiles?: () => void;
  extractButton?: React.ReactNode;
}

export const ReceiptUpload = ({ onFilesSelected, selectedFiles, onRemoveFile, onClearFiles, extractButton }: ReceiptUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      
      const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/') || file.type === 'application/pdf'
      );
      
      if (files.length > 0) {
        onFilesSelected([...selectedFiles, ...files].slice(0, 30));
      }
    },
    [onFilesSelected, selectedFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );
    
      if (files.length > 0) {
        onFilesSelected([...selectedFiles, ...files].slice(0, 30));
      }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        id="file-upload"
        type="file"
        multiple
        accept="image/*,.pdf"
        onChange={handleFileInput}
        ref={fileInputRef}
        className="hidden"
      />
      {selectedFiles.length === 0 ? (
        /* Upload Area - Show when no files selected */
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 md:p-12 text-center mesh-transition cursor-pointer ${
            isDragging
              ? "border-turquoise-400 bg-turquoise-50 scale-[1.02] mesh-shadow-turquoise"
              : isHovered
              ? "border-turquoise-400 bg-turquoise-50 scale-[1.02] mesh-shadow-turquoise"
              : "border-gray-300 hover:border-turquoise-300 hover:bg-gray-50"
          }`}
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-4 left-4 w-8 h-8 bg-turquoise-500 rounded-full"></div>
            <div className="absolute top-8 right-8 w-6 h-6 bg-blue-500 rounded-full"></div>
            <div className="absolute bottom-6 left-8 w-4 h-4 bg-purple-500 rounded-full"></div>
          </div>

          <div className="relative">
            {/* Upload Icon */}
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-turquoise-100 to-turquoise-200 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 mesh-float">
              <Upload className="h-8 w-8 sm:h-10 sm:w-10 text-turquoise-600" />
            </div>

            {/* Main Text */}
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mb-2 sm:mb-3">
              Drag & drop / Upload your receipts
            </h3>
            

            {/* File Count */}
            <p className="text-xs sm:text-sm text-gray-500 mt-4 sm:mt-6 px-2">
              Up to 30 files • Supports JPG, PNG, WEBP, HEIC, PDF formats ((Max 1MB each))
            </p>
          </div>
        </div>
      ) : (
        /* Selected Files View */
        <div className="space-y-4">
          {/* Header with Add More Files button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <h4 className="text-base sm:text-lg font-semibold text-gray-800">
              Selected Files ({selectedFiles.length}/30)
            </h4>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                <div className="w-2 h-2 bg-turquoise-500 rounded-full"></div>
                Ready to process
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="text-xs sm:text-sm px-3 py-1.5"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Add More Files</span>
                  <span className="sm:hidden">Add More</span>
                </Button>
                {onClearFiles && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClearFiles}
                    className="text-xs sm:text-sm text-gray-600 hover:text-red-600 hover:border-red-300 px-3 py-1.5"
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Extract Data Button - Centered */}
          {extractButton && (
            <div className="flex justify-center py-4">
              {extractButton}
            </div>
          )}

          {/* Files Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {selectedFiles.map((file, index) => (
              <div 
                key={index} 
                className="group mesh-card p-3 mesh-transition hover:scale-105"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* File Icon */}
                    <div className="flex-shrink-0">
                      {file.type.startsWith('image/') ? (
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                          <Image className="h-4 w-4 text-blue-600" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-red-100 to-red-200 rounded-lg flex items-center justify-center">
                          <File className="h-4 w-4 text-red-600" />
                        </div>
                      )}
                    </div>
                    
                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  
                  {/* Remove Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFile(index)}
                    className="opacity-0 group-hover:opacity-100 mesh-transition-fast text-gray-400 hover:text-red-500 p-1 h-6 w-6"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
