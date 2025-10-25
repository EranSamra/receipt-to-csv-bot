import { useCallback, useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ReceiptUploadProps {
  onFilesSelected: (files: File[]) => void;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
}

export const ReceiptUpload = ({ onFilesSelected, selectedFiles, onRemoveFile }: ReceiptUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      
      const files = Array.from(e.dataTransfer.files).filter(file => 
        file.type.startsWith('image/')
      );
      
      if (files.length > 0) {
        onFilesSelected([...selectedFiles, ...files].slice(0, 10));
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
      file.type.startsWith('image/')
    );
    
    if (files.length > 0) {
      onFilesSelected([...selectedFiles, ...files].slice(0, 10));
    }
  };

  return (
    <div className="space-y-4">
      <Card
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed transition-all duration-200 ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border hover:border-primary/50"
        }`}
      >
        <div className="p-12 text-center">
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Upload Receipt Images</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop up to 10 receipt images, or click to browse
          </p>
          <label htmlFor="file-upload">
            <Button type="button" variant="default" asChild>
              <span className="cursor-pointer">
                Select Files
              </span>
            </Button>
          </label>
          <input
            id="file-upload"
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground mt-4">
            Supports JPG, PNG, WEBP, HEIC formats
          </p>
        </div>
      </Card>

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Selected Files ({selectedFiles.length}/10)</h4>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFile(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
