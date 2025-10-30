import { useState } from "react";
import { X, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ExampleReceipt {
  id: string;
  name: string;
  description: string;
  filename: string;
  thumbnail: string;
}

interface ExamplesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSelected: (selectedFiles: File[]) => void;
}

const exampleReceipts: ExampleReceipt[] = [
  {
    id: "fake-receipt",
    name: "Fake Receipt",
    description: "Sample business receipt with subscription",
    filename: "fake-receipt.png",
    thumbnail: "/sample-receipts/fake-receipt.png"
  },
  {
    id: "restaurant-receipt",
    name: "Restaurant Receipt",
    description: "Dining receipt with multiple items",
    filename: "restaurant-receipt.png",
    thumbnail: "/sample-receipts/restaurant-receipt.png"
  },
  {
    id: "gas-station-receipt",
    name: "Gas Station Receipt",
    description: "Fuel and convenience store purchase",
    filename: "gas-station-receipt.png",
    thumbnail: "/sample-receipts/gas-station-receipt.png"
  },
  {
    id: "hotel-receipt",
    name: "Hotel Invoice",
    description: "Hotel accommodation and services",
    filename: "hotel-receipt.png",
    thumbnail: "/sample-receipts/hotel-receipt.png"
  },
  {
    id: "grocery-receipt",
    name: "Grocery Store",
    description: "Supermarket shopping receipt",
    filename: "grocery-receipt.png",
    thumbnail: "/sample-receipts/grocery-receipt.png"
  },
  {
    id: "pharmacy-receipt",
    name: "Pharmacy Receipt",
    description: "Medical and health products",
    filename: "pharmacy-receipt.png",
    thumbnail: "/sample-receipts/pharmacy-receipt.png"
  },
  {
    id: "office-supplies",
    name: "Office Supplies",
    description: "Business equipment and supplies",
    filename: "office-supplies.png",
    thumbnail: "/sample-receipts/office-supplies.png"
  },
  {
    id: "transport-receipt",
    name: "Transport Receipt",
    description: "Taxi, ride-share, or public transport",
    filename: "transport-receipt.png",
    thumbnail: "/sample-receipts/transport-receipt.png"
  },
  {
    id: "entertainment",
    name: "Entertainment",
    description: "Movie, concert, or event tickets",
    filename: "entertainment.png",
    thumbnail: "/sample-receipts/entertainment.png"
  }
];

export const ExamplesModal = ({ isOpen, onClose, onLoadSelected }: ExamplesModalProps) => {
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [previewReceipt, setPreviewReceipt] = useState<ExampleReceipt | null>(null);

  if (!isOpen) return null;

  const toggleReceipt = (receipt: ExampleReceipt) => {
    setPreviewReceipt(receipt);
    setSelectedReceipts(prev =>
      prev.includes(receipt.id)
        ? prev.filter(id => id !== receipt.id)
        : [...prev, receipt.id]
    );
  };

  const handleLoadSelected = async () => {
    if (selectedReceipts.length === 0) return;

    const files: File[] = [];
    
    for (const receiptId of selectedReceipts) {
      const receipt = exampleReceipts.find(r => r.id === receiptId);
      if (receipt) {
        try {
          const response = await fetch(receipt.thumbnail);
          if (response.ok) {
            const blob = await response.blob();
            const file = new File([blob], receipt.filename, { type: 'image/png' });
            files.push(file);
          }
        } catch (error) {
          console.warn(`Could not load sample receipt: ${receipt.filename}`, error);
        }
      }
    }

    if (files.length > 0) {
      onLoadSelected(files);
      onClose();
      setSelectedReceipts([]);
      setPreviewReceipt(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-[95vw] h-[90vh] max-w-6xl max-h-[800px] flex flex-col lg:flex-row overflow-hidden">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white/90 hover:bg-white"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Mobile: Thumbnails Section (Top) */}
        <div className="lg:w-1/2 p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-gray-200 overflow-y-auto max-h-[40vh] lg:max-h-none">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Sample Receipts</h2>
            <p className="text-sm sm:text-base text-gray-600">Select receipts to load as examples</p>
          </div>

          {/* Mobile: Grid layout for thumbnails */}
          <div className="grid grid-cols-2 sm:grid-cols-1 lg:grid-cols-1 gap-3 sm:gap-4">
            {exampleReceipts.map((receipt) => (
              <Card
                key={receipt.id}
                className={`p-3 sm:p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                  selectedReceipts.includes(receipt.id) 
                    ? 'ring-2 ring-turquoise-500 bg-turquoise-50' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleReceipt(receipt)}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Checkbox */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReceipt(receipt);
                      }}
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedReceipts.includes(receipt.id)
                          ? 'bg-turquoise-500 border-turquoise-500 text-white'
                          : 'border-gray-300 hover:border-turquoise-400'
                      }`}
                    >
                      {selectedReceipts.includes(receipt.id) && (
                        <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      )}
                    </button>
                  </div>

                  {/* Thumbnail - Larger on mobile */}
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    <img
                      src={receipt.thumbnail}
                      alt={receipt.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to placeholder if image fails to load
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      <Eye className="h-4 w-4 sm:h-6 sm:w-6 text-gray-500" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-800 truncate">
                      {receipt.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">
                      {receipt.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Mobile: Preview Section (Bottom) */}
        <div className="lg:w-1/2 p-4 sm:p-6 flex flex-col flex-1">
          <div className="mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Preview</h3>
            <p className="text-sm sm:text-base text-gray-600">
              {previewReceipt ? `Click thumbnails to preview` : 'Select a receipt to preview'}
            </p>
          </div>

          <div className="flex-1 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden min-h-[200px] sm:min-h-[300px]">
            {previewReceipt ? (
              <img
                src={previewReceipt.thumbnail}
                alt={previewReceipt.name}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : (
              <div className="text-center text-gray-500">
                <Eye className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm sm:text-base">Click a thumbnail to preview</p>
              </div>
            )}
            
            {/* Fallback for failed images */}
            <div className="hidden text-center text-gray-500">
              <Eye className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm sm:text-base">Preview not available</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLoadSelected}
              disabled={selectedReceipts.length === 0}
              className="flex-1 mesh-btn-primary order-1 sm:order-2"
            >
              Load Selected ({selectedReceipts.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
