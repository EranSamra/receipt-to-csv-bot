import { useState, useEffect } from "react";
import { Receipt, Sparkles, Zap, Shield, Brain, ArrowRight, CheckCircle } from "lucide-react";
import { ReceiptUpload } from "@/components/ReceiptUpload";
import { ExamplesUpload } from "@/components/ExamplesUpload";
import { ExamplesModal } from "@/components/ExamplesModal";
import { ResultsTable, ReceiptData } from "@/components/ResultsTable";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { convertToCSV, downloadCSV } from "@/utils/csvUtils";
import { ParticleTextEffect } from "@/components/ui/particle-text-effect";

const Index = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ReceiptData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [animateHero, setAnimateHero] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showParticleEffect, setShowParticleEffect] = useState(false);
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const { toast } = useToast();

  // Trigger animations on mount
  useEffect(() => {
    setAnimateHero(true);
  }, []);

  // Auto-scroll to results when extraction completes
  useEffect(() => {
    if (showResults && results.length > 0) {
      setTimeout(() => {
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
          resultsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 500); // Small delay to allow animation to complete
    }
  }, [showResults, results]);

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearFiles = () => {
    setSelectedFiles([]);
    setShowResults(false);
    setResults([]);
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
    setProcessingProgress(0);
    setShowParticleEffect(true);

    try {
      // Simulate progress updates for better UX
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      // Use local server for development
      const response = await fetch('http://localhost:3001/api/extract-receipts', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProcessingProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process receipts');
      }

      const data = await response.json();
      const parsedResults = parseCSVToResults(data.csv);
      
      setResults(parsedResults);
      setShowResults(true);
      setShowConfetti(true);
      
      // Hide confetti after animation
      setTimeout(() => setShowConfetti(false), 5000);
      
      toast({
        title: "✅ Data extracted successfully",
        description: "Your receipts have been processed using Mesh AI Extraction Engine.",
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
      setProcessingProgress(0);
      setShowParticleEffect(false);
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

  const handleOpenExamplesModal = () => {
    setShowExamplesModal(true);
  };

  const handleLoadSelectedExamples = (files: File[]) => {
    setSelectedFiles(files);
    toast({
      title: "Examples Loaded",
      description: `Loaded ${files.length} sample receipt${files.length > 1 ? 's' : ''} for testing`,
    });
  };

  return (
    <div className="min-h-screen mesh-gradient-dark">
      {/* Particle Text Effect Overlay */}
      {showParticleEffect && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
          <div className="relative z-50">
            <ParticleTextEffect 
              words={["PROCESSING", "ANALYZING", "MESH AI", "EXTRACTING", "WORKING"]}
              width={800}
              height={400}
              className="rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Jumping Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {/* Confetti pieces with different shapes and colors */}
          {Array.from({ length: 120 }, (_, i) => (
            <div
              key={i}
              className="absolute confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                backgroundColor: ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'][Math.floor(Math.random() * 6)],
                width: `${Math.random() * 8 + 4}px`,
                height: `${Math.random() * 8 + 4}px`,
                animationDelay: `${Math.random() * 1.5}s`,
                animationDuration: `${Math.random() * 2 + 4}s`,
                transform: `rotate(${Math.random() * 360}deg)`,
                borderRadius: Math.random() > 0.5 ? '50%' : '0%',
              }}
            />
          ))}
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-turquoise-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-4000"></div>
        </div>

        <div className="relative container mx-auto px-4 py-20">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <header className="text-center mb-16">
              <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8 mesh-fade-in`}>
                <div className="p-2 bg-turquoise-500 rounded-lg">
                  <Receipt className="h-5 w-5 text-white" />
                </div>
                <span className="text-white font-medium">Powered by Mesh AI</span>
              </div>
              
              <h1 className={`mesh-heading-xl mb-6 ${animateHero ? 'mesh-fade-in' : 'opacity-0'}`}>
                Receipt Data Extractor
              </h1>
              
              <p className={`mesh-text-lg max-w-3xl mx-auto mb-8 ${animateHero ? 'mesh-slide-up' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
                Upload your receipts and instantly convert them into structured expense data powered by AI. 
                <span className="text-turquoise-400 font-semibold"> Accurate. Secure. Built for Finance Teams.</span>
              </p>

              {/* Feature Pills */}
              <div className={`flex flex-wrap justify-center gap-4 mb-12 ${animateHero ? 'mesh-scale-in' : 'opacity-0'}`} style={{ animationDelay: '0.4s' }}>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                  <Zap className="h-4 w-4 text-turquoise-400" />
                  <span className="text-white text-sm font-medium">AI-Powered</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                  <Shield className="h-4 w-4 text-turquoise-400" />
                  <span className="text-white text-sm font-medium">Secure</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                  <Brain className="h-4 w-4 text-turquoise-400" />
                  <span className="text-white text-sm font-medium">Smart Extraction</span>
                </div>
              </div>
            </header>

            {/* Main Upload Cards */}
            <div className={`max-w-6xl mx-auto ${animateHero ? 'mesh-scale-in' : 'opacity-0'}`} style={{ animationDelay: '0.6s' }}>
              {selectedFiles.length === 0 ? (
                // Two cards side by side when no files selected
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                  {/* Upload Files Card */}
                  <div className="mesh-card p-4 sm:p-6 lg:p-8 mesh-shadow-xl">
                    <ReceiptUpload
                      onFilesSelected={setSelectedFiles}
                      selectedFiles={selectedFiles}
                      onRemoveFile={handleRemoveFile}
                    />
                  </div>
                  
                  {/* Examples Card */}
                  <div className="mesh-card p-4 sm:p-6 lg:p-8 mesh-shadow-xl">
                    <ExamplesUpload
                      onOpenModal={handleOpenExamplesModal}
                      isProcessing={isProcessing}
                    />
                  </div>
                </div>
              ) : (
                // Single expanded card when files are selected
                <div className="mesh-card p-4 sm:p-6 lg:p-8 mesh-shadow-xl">
                  <ReceiptUpload
                    onFilesSelected={setSelectedFiles}
                    selectedFiles={selectedFiles}
                    onRemoveFile={handleRemoveFile}
                    onClearFiles={handleClearFiles}
                    extractButton={
                      <div className="space-y-6">
                        <Button
                          onClick={handleProcess}
                          disabled={isProcessing}
                          size="lg"
                          className="mesh-btn-primary text-lg px-12 py-4"
                        >
                          {isProcessing ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                              Processing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-5 w-5 mr-3" />
                              Extract Data
                            </>
                          )}
                        </Button>

                        {isProcessing && (
                          <div className="space-y-4">
                            <div className="bg-gray-100 rounded-full h-3 overflow-hidden max-w-md mx-auto">
                              <div 
                                className="h-full mesh-gradient-primary transition-all duration-500 ease-out"
                                style={{ width: `${processingProgress}%` }}
                              ></div>
                            </div>
                            <p className="text-center text-gray-600 font-medium">
                              Processing {selectedFiles.length} receipt{selectedFiles.length > 1 ? 's' : ''}... {processingProgress}%
                            </p>
                          </div>
                        )}
                      </div>
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      {showResults && results.length > 0 && (
        <section id="results-section" className="py-20 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 right-10 w-32 h-32 bg-turquoise-500 rounded-full mix-blend-multiply filter blur-xl"></div>
            <div className="absolute bottom-10 left-10 w-24 h-24 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl"></div>
          </div>
          
          <div className="container mx-auto px-4 relative">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
                  🎉 Extracted Receipt Data
                </h2>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
                  Your receipts have been successfully processed and structured using Mesh AI
                </p>
                <div className="flex justify-center">
                  <Button
                    onClick={handleDownloadCSV}
                    className="bg-gradient-to-r from-turquoise-500 to-turquoise-600 hover:from-turquoise-600 hover:to-turquoise-700 text-white text-lg px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <CheckCircle className="h-6 w-6 mr-3" />
                    Download CSV
                  </Button>
                </div>
              </div>

              <div className="mesh-card p-8 mesh-shadow-xl border-2 border-turquoise-100">
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Expense Data</h3>
                  <p className="text-gray-600">{results.length} receipt{results.length > 1 ? 's' : ''} processed successfully</p>
                </div>
                <ResultsTable data={results} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            Built with ❤️ using Mesh AI Extraction Engine
          </p>
        </div>
      </footer>

      {/* Examples Modal */}
      <ExamplesModal
        isOpen={showExamplesModal}
        onClose={() => setShowExamplesModal(false)}
        onLoadSelected={handleLoadSelectedExamples}
      />
    </div>
  );
};

export default Index;
