import { useState } from "react";
import { Receipt, Sparkles } from "lucide-react";
import { ReceiptUpload } from "@/components/ReceiptUpload";
import { ResultsTable, ReceiptData } from "@/components/ResultsTable";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { convertToCSV, downloadCSV } from "@/utils/csvUtils";

const Index = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ReceiptData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const parseCSVToResults = (csvText: string): ReceiptData[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const dataRows = lines.slice(1);

    return dataRows.map(row => {
      // Handle quoted fields with commas
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current);

      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = values[index]?.replace(/^"|"$/g, '').replace(/""/g, '"') || '';
      });

      return obj as ReceiptData;
    });
  };

  const handleProcess = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please upload at least one receipt image",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-receipts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process receipts');
      }

      const data = await response.json();
      const parsedResults = parseCSVToResults(data.csv);
      
      setResults(parsedResults);
      
      toast({
        title: "Success!",
        description: `Extracted data from ${parsedResults.length} receipt(s)`,
      });

    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Failed to process receipts",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadCSV = () => {
    if (results.length === 0) return;
    
    const csv = convertToCSV(results);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `receipts-${timestamp}.csv`);
    
    toast({
      title: "CSV Downloaded",
      description: "Your expense data has been exported",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Receipt Scanner</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered expense extraction to CSV
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Upload Section */}
          <div>
            <ReceiptUpload
              onFilesSelected={setSelectedFiles}
              selectedFiles={selectedFiles}
              onRemoveFile={handleRemoveFile}
            />
            
            {selectedFiles.length > 0 && (
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={handleProcess}
                  disabled={isProcessing}
                  size="lg"
                  className="gap-2 px-8"
                >
                  <Sparkles className="h-5 w-5" />
                  {isProcessing ? 'Processing...' : 'Extract Data'}
                </Button>
              </div>
            )}
          </div>

          {/* Results Section */}
          <ResultsTable results={results} onDownloadCSV={handleDownloadCSV} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-24 border-t bg-card">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-sm text-muted-foreground">
            Powered by Lovable Cloud • Extracts receipts in any language and currency
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
