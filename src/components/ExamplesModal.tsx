import { useState, useEffect } from "react";
import { X, Check, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trackEvent, Events } from "@/utils/posthogEvents";

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
    name: "AI-Generated Receipt",
    description: "AI-created fake receipt for testing fraud detection",
    filename: "fake-receipt.png",
    thumbnail: "/sample-receipts/fake-receipt.png"
  },
  {
    id: "restaurant-receipt",
    name: "Restaurant Receipt",
    description: "Dining receipt with multiple items",
    filename: "restaurant-receipt.jpeg",
    thumbnail: "/sample-receipts/restaurant-receipt.jpeg"
  },
  {
    id: "alcohol-receipt",
    name: "Alcohol Receipt",
    description: "Liquor store receipt with alcohol purchases",
    filename: "alcohol example.png",
    thumbnail: "/sample-receipts/alcohol example.png"
  },
  {
    id: "software-receipt",
    name: "Software Receipt",
    description: "Software subscription or license purchase",
    filename: "software.png",
    thumbnail: "/sample-receipts/software.png"
  },
  {
    id: "hotel-receipt",
    name: "Hotel Invoice",
    description: "Hotel accommodation and services",
    filename: "hotel-receipt copy.png",
    thumbnail: "/sample-receipts/hotel-receipt copy.png"
  },
  {
    id: "grocery-receipt",
    name: "Grocery Store",
    description: "Supermarket shopping receipt",
    filename: "grocery-receipt.jpeg",
    thumbnail: "/sample-receipts/grocery-receipt.jpeg"
  },
  {
    id: "amazon-receipt",
    name: "Amazon Receipt",
    description: "Online marketplace order receipt",
    filename: "Amazon.png",
    thumbnail: "/sample-receipts/Amazon.png"
  },
  {
    id: "office-supplies",
    name: "Google Ads",
    description: "Digital advertising campaign receipt",
    filename: "google ads.png",
    thumbnail: "/sample-receipts/google ads.png"
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

  // Track modal open/close
  useEffect(() => {
    if (isOpen) {
      trackEvent(Events.EXAMPLES_MODAL_OPENED);
    } else {
      trackEvent(Events.EXAMPLES_MODAL_CLOSED);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleReceipt = (receipt: ExampleReceipt) => {
    // Always update preview when clicking any card
    console.log('Clicking on receipt:', receipt.name, 'Current preview:', previewReceipt?.name);
    
    // Track example preview
    if (previewReceipt?.id !== receipt.id) {
      trackEvent(Events.EXAMPLE_PREVIEWED, {
        receipt_id: receipt.id,
        receipt_name: receipt.name
      });
    }
    
    setPreviewReceipt(receipt);
    setSelectedReceipts(prev => {
      const newSelection = prev.includes(receipt.id)
        ? prev.filter(id => id !== receipt.id)
        : [...prev, receipt.id];
      console.log('New selection:', newSelection);
      return newSelection;
    });
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
      trackEvent(Events.EXAMPLES_LOADED, {
        example_count: files.length,
        receipt_ids: selectedReceipts
      });
      
      onLoadSelected(files);
      onClose();
      setSelectedReceipts([]);
      setPreviewReceipt(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 lg:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal - Full screen on mobile, centered on desktop */}
      <div className="relative bg-white w-full h-full lg:w-[95vw] lg:h-[90vh] lg:max-w-6xl lg:max-h-[800px] lg:rounded-2xl shadow-2xl flex flex-col lg:flex-row overflow-hidden">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-3 right-3 lg:top-4 lg:right-4 z-10 bg-white/90 hover:bg-white rounded-full p-2 lg:p-1.5"
        >
          <X className="h-5 w-5 lg:h-4 lg:w-4" />
        </Button>

        {/* Thumbnails Section - Full width on mobile, half on desktop */}
        <div className="lg:w-1/2 p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-gray-200 overflow-y-auto flex-1 lg:flex-none lg:max-h-none">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Sample Receipts</h2>
            <p className="text-sm sm:text-base text-gray-600">Select receipts to load as examples</p>
          </div>

          {/* Single column layout - mobile optimized, desktop unchanged */}
          <div className="space-y-3 sm:space-y-4 lg:space-y-4">
            {exampleReceipts.map((receipt) => (
              <Card
                key={receipt.id}
                className={`p-4 sm:p-5 cursor-pointer transition-all duration-200 active:scale-[0.98] touch-manipulation ${
                  selectedReceipts.includes(receipt.id) 
                    ? 'ring-2 ring-turquoise-500 bg-turquoise-50' 
                    : 'hover:bg-gray-50 active:bg-gray-100'
                }`}
                onClick={() => toggleReceipt(receipt)}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox - Larger touch target on mobile */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReceipt(receipt);
                      }}
                      className={`w-6 h-6 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center transition-colors touch-manipulation ${
                        selectedReceipts.includes(receipt.id)
                          ? 'bg-turquoise-500 border-turquoise-500 text-white'
                          : 'border-gray-300 hover:border-turquoise-400 active:border-turquoise-500'
                      }`}
                    >
                      {selectedReceipts.includes(receipt.id) && (
                        <Check className="h-4 w-4 sm:h-3 sm:w-3" />
                      )}
                    </button>
                  </div>

                  {/* Thumbnail - Larger on mobile */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img
                      src={`${receipt.thumbnail}?v=${Date.now()}`}
                      alt={receipt.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      <Eye className="h-6 w-6 sm:h-8 sm:w-8 text-gray-500" />
                    </div>
                  </div>

                  {/* Info - Wrap on mobile, truncate on desktop to preserve layout */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1 break-words sm:truncate">
                      {receipt.name}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 line-clamp-2 sm:truncate">
                      {receipt.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Preview Section - Full width on mobile, half on desktop */}
        <div className="lg:w-1/2 p-4 sm:p-6 flex flex-col flex-1 lg:flex-none min-h-0">
          <div className="mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Preview</h3>
            <p className="text-sm sm:text-base text-gray-600">
              {previewReceipt ? `Click thumbnails to preview` : 'Select a receipt to preview'}
            </p>
          </div>

          <div className="flex-1 bg-gray-50 rounded-lg overflow-hidden min-h-[250px] sm:min-h-[300px] lg:min-h-[400px] relative">
            {previewReceipt ? (
              <div key={previewReceipt.id} className="w-full h-full relative">
                <img
                  src={`${previewReceipt.thumbnail}?v=${Date.now()}`}
                  alt={previewReceipt.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                {/* Fallback for failed images */}
                <div className="hidden absolute inset-0 flex items-center justify-center text-center text-gray-500">
                  <div>
                    <Eye className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-xs sm:text-sm">Preview not available</p>
                  </div>
                </div>
                {/* Receipt info overlay - Hidden on mobile to save space */}
                <div className="hidden sm:block absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-3">
                  <h4 className="text-sm sm:text-base font-semibold mb-1">
                    {previewReceipt.name}
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-200">
                    {previewReceipt.description}
                  </p>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-center text-gray-500">
                <div>
                  <Eye className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-sm sm:text-base">Tap a receipt to preview</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons - Sticky on mobile */}
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 lg:border-t-0 lg:pt-0">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 sm:h-10 order-2 sm:order-1 text-base sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLoadSelected}
              disabled={selectedReceipts.length === 0}
              className="flex-1 h-12 sm:h-10 bg-[#14b8a6] hover:bg-[#0d9488] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 order-1 sm:order-2 text-base sm:text-sm"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Extract Data {selectedReceipts.length > 0 && `(${selectedReceipts.length})`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
