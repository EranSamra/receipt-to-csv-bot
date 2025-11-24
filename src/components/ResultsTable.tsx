import { FileText, DollarSign, Building, AlertTriangle, ChevronDown, ChevronRight, Filter, Shield, CheckCircle2, AlertOctagon, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";

export interface LineItem {
  description: string;
  date: string;
  amount: string;
  category: string;
}

export interface ReceiptData {
  "Invoice Number": string;
  "Date": string;
  "Amount": string;
  "Currency": string;
  "Merchant": string;
  "Fraud Risk": string;
  "Duplicate": string;
  "Alcohol/Tobacco": string;
  "Personal Expense": string;
  "Notes": string;
  lineItems?: LineItem[];
  receiptImage?: string;
  [key: string]: string | LineItem[] | undefined;
}

interface ResultsTableProps {
  data: ReceiptData[];
  receiptImages?: Map<string, string>;
}

export const ResultsTable = ({ data, receiptImages }: ResultsTableProps) => {
  if (data.length === 0) return null;

  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => {
    const initialExpanded = new Set<number>();
    data.forEach((row, index) => {
      if (row.lineItems && row.lineItems.length > 0) {
        initialExpanded.add(index);
      }
    });
    return initialExpanded;
  });
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  useEffect(() => {
    const newExpanded = new Set<number>();
    data.forEach((row, index) => {
      if (row.lineItems && row.lineItems.length > 0) {
        newExpanded.add(index);
      }
    });
    const currentSize = expandedRows.size;
    const newSize = newExpanded.size;
    const hasChanges = currentSize !== newSize || 
      Array.from(newExpanded).some(idx => !expandedRows.has(idx));
    
    if (hasChanges) {
      setExpandedRows(newExpanded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]);

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const hasAnyFlagCheck = (row: ReceiptData) => {
    const isDuplicate = row["Duplicate"]?.toLowerCase() === 'yes';
    const fraudRisk = row["Fraud Risk"]?.toLowerCase() || 'low';
    const hasAlcoholTobacco = row["Alcohol/Tobacco"]?.toLowerCase() === 'yes';
    const hasPersonalExpense = row["Personal Expense"]?.toLowerCase().includes('suspicious');
    return isDuplicate || (fraudRisk === 'high' || fraudRisk === 'medium') || hasAlcoholTobacco || hasPersonalExpense;
  };

  const duplicateCount = data.filter(row => row["Duplicate"]?.toLowerCase() === 'yes').length;
  const hasDuplicates = duplicateCount > 0;
  const fraudRiskCount = data.filter(row => row["Fraud Risk"]?.toLowerCase() === 'high' || row["Fraud Risk"]?.toLowerCase() === 'medium').length;
  const alcoholTobaccoCount = data.filter(row => row["Alcohol/Tobacco"]?.toLowerCase() === 'yes').length;
  const personalExpenseCount = data.filter(row => row["Personal Expense"]?.toLowerCase().includes('suspicious')).length;
  
  const filteredData = showFlaggedOnly ? data.filter(hasAnyFlagCheck) : data;
  const flaggedCount = data.filter(hasAnyFlagCheck).length;
  const totalAmount = data.reduce((sum, row) => {
    const amount = parseFloat(row["Amount"]?.replace(/[^0-9.-]/g, '') || '0');
    return sum + amount;
  }, 0).toFixed(2);

  return (
    <div className="space-y-8">
      
      {/* 1. Bento Grid Summary (Glassmorphism) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Processed */}
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-turquoise-500/10 rounded-full blur-2xl -mr-16 -mt-16 transition-all group-hover:bg-turquoise-500/20"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Processed</span>
              <div className="p-2 bg-turquoise-50 rounded-lg">
                <FileText className="h-5 w-5 text-turquoise-600" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-bold text-gray-900 animate-count">{data.length}</h3>
              <span className="text-gray-500 text-sm">Receipts</span>
            </div>
          </div>
        </div>

        {/* Total Amount */}
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -ml-16 -mb-16 transition-all group-hover:bg-blue-500/20"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Value</span>
              <div className="p-2 bg-blue-50 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-bold text-gray-900 animate-count">${totalAmount}</h3>
              <span className="text-gray-500 text-sm">USD</span>
            </div>
          </div>
        </div>

        {/* Unique Merchants */}
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-pink-400 opacity-50"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Merchants</span>
              <div className="p-2 bg-purple-50 rounded-lg">
                <Building className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-bold text-gray-900 animate-count">
                {new Set(data.map(row => row["Merchant"])).size}
              </h3>
              <span className="text-gray-500 text-sm">Unique</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Insights Bar (Active Intelligence) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${flaggedCount > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
              {flaggedCount > 0 ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <Shield className="h-5 w-5 text-green-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {flaggedCount > 0 ? 'Policy Violations Detected' : 'All Clear'}
              </h3>
              <p className="text-sm text-gray-500">
                {flaggedCount > 0 
                  ? `${flaggedCount} receipt${flaggedCount !== 1 ? 's' : ''} require attention`
                  : 'No policy violations found in processed receipts'}
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
            variant="outline"
            size="sm"
            className={`gap-2 transition-all ${showFlaggedOnly ? "bg-gray-900 text-white border-gray-900 hover:bg-gray-800 hover:text-white" : "hover:bg-gray-100"}`}
          >
            <Filter className="h-4 w-4" />
            {showFlaggedOnly ? 'Show All Receipts' : 'Filter Flagged Only'}
          </Button>
        </div>

        {/* Active Insights Grid */}
        {(hasDuplicates || fraudRiskCount > 0 || alcoholTobaccoCount > 0 || personalExpenseCount > 0) && (
          <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {hasDuplicates && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="bg-white p-1.5 rounded-md shadow-sm">
                  <Copy className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <span className="block text-xs font-medium text-red-900 uppercase">Duplicate</span>
                  <span className="block text-sm font-bold text-red-700">{duplicateCount} Found</span>
                </div>
              </div>
            )}
            {fraudRiskCount > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-100">
                <div className="bg-white p-1.5 rounded-md shadow-sm">
                  <AlertOctagon className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <span className="block text-xs font-medium text-orange-900 uppercase">AI / Fraud</span>
                  <span className="block text-sm font-bold text-orange-700">{fraudRiskCount} Suspicious</span>
                </div>
              </div>
            )}
            {alcoholTobaccoCount > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-100">
                <div className="bg-white p-1.5 rounded-md shadow-sm">
                  <Wine className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <span className="block text-xs font-medium text-yellow-900 uppercase">Restricted</span>
                  <span className="block text-sm font-bold text-yellow-700">{alcoholTobaccoCount} Items</span>
                </div>
              </div>
            )}
            {personalExpenseCount > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 border border-purple-100">
                <div className="bg-white p-1.5 rounded-md shadow-sm">
                  <ShoppingBag className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <span className="block text-xs font-medium text-purple-900 uppercase">Personal</span>
                  <span className="block text-sm font-bold text-purple-700">{personalExpenseCount} Potential</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Floating Card List (Replaces Standard Table) */}
      <div className="space-y-4">
        {/* Header Row (Pseudo-table) */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 text-sm font-medium text-gray-500 uppercase tracking-wider">
          <div className="col-span-1"></div> {/* Toggle */}
          <div className="col-span-1"></div> {/* Image */}
          <div className="col-span-2">Invoice #</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2">Merchant</div>
          <div className="col-span-2">Status</div>
        </div>

        {filteredData.map((row, index) => {
          const isDuplicate = row["Duplicate"]?.toLowerCase() === 'yes';
          const fraudRisk = row["Fraud Risk"]?.toLowerCase() || 'low';
          const hasAlcoholTobacco = row["Alcohol/Tobacco"]?.toLowerCase() === 'yes';
          const hasPersonalExpense = row["Personal Expense"]?.toLowerCase().includes('suspicious');
          const hasLineItems = row.lineItems && row.lineItems.length > 0;
          const isExpanded = expandedRows.has(index);
          const hasAnyFlag = isDuplicate || (fraudRisk === 'high' || fraudRisk === 'medium') || hasAlcoholTobacco || hasPersonalExpense;
          
          const invoiceNumber = row["Invoice Number"] || '';
          const receiptImageUrl = row.receiptImage || 
            (invoiceNumber ? receiptImages?.get(invoiceNumber) : receiptImages?.get(`receipt-${index}`));
          const notes = row["Notes"] || '';

          return (
            <div 
              key={`card-${index}`}
              className={`group floating-row overflow-hidden ${hasAnyFlag ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-transparent hover:border-l-turquoise-400'}`}
            >
              {/* Main Card Content */}
              <div className="p-4 lg:p-0 lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center">
                
                {/* Mobile Header: Merchant & Amount */}
                <div className="lg:hidden flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-lg text-gray-900">{row["Merchant"] || 'Unknown'}</h4>
                    <p className="text-sm text-gray-500">{row["Date"] || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-lg text-gray-900">{row["Amount"]} {row["Currency"]}</span>
                    <span className="text-xs text-gray-400">{invoiceNumber}</span>
                  </div>
                </div>

                {/* Desktop Columns */}
                <div className="hidden lg:flex col-span-1 justify-center">
                  {hasLineItems && (
                    <button
                      onClick={() => toggleRow(index)}
                      className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-turquoise-600"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  )}
                </div>

                <div className="col-span-1 mb-4 lg:mb-0 flex justify-center lg:justify-start">
                  <div className="relative w-12 h-16 lg:w-14 lg:h-18 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 group-hover:shadow-md transition-all">
                    {receiptImageUrl ? (
                      <img 
                        src={receiptImageUrl} 
                        alt="Receipt" 
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => {
                          const img = document.createElement('img');
                          img.src = receiptImageUrl;
                          img.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:90vw;max-height:90vh;z-index:9999;border-radius:8px;box-shadow:0 20px 50px rgba(0,0,0,0.5);';
                          const overlay = document.createElement('div');
                          overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9998;backdrop-filter:blur(5px);';
                          document.body.appendChild(overlay);
                          document.body.appendChild(img);
                          const cleanup = () => { overlay.remove(); img.remove(); };
                          overlay.onclick = cleanup;
                          img.onclick = cleanup;
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300">
                        <FileText className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="hidden lg:block col-span-2 text-sm font-medium text-gray-700 truncate">
                  {invoiceNumber || <span className="text-gray-400 italic">No Invoice #</span>}
                </div>

                <div className="hidden lg:block col-span-2 text-sm text-gray-600">
                  {row["Date"] || '-'}
                </div>

                <div className="hidden lg:block col-span-2 font-mono font-semibold text-gray-900">
                  {row["Amount"]} <span className="text-gray-400 text-xs">{row["Currency"]}</span>
                </div>

                <div className="hidden lg:block col-span-2 text-sm font-medium text-gray-800 truncate">
                  {row["Merchant"] || '-'}
                </div>

                <div className="col-span-12 lg:col-span-2 flex flex-wrap gap-2 mt-2 lg:mt-0">
                  {!hasAnyFlag && !notes && (
                    <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100 text-xs font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Valid
                    </span>
                  )}
                  {isDuplicate && <span className="tech-badge tech-badge-error">Duplicate</span>}
                  {(fraudRisk === 'high' || fraudRisk === 'medium') && <span className="tech-badge tech-badge-error">AI / Fraud</span>}
                  {hasAlcoholTobacco && <span className="tech-badge tech-badge-warning">Restricted</span>}
                  {hasPersonalExpense && <span className="tech-badge tech-badge-warning">Personal</span>}
                  {notes && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="tech-badge bg-gray-100 text-gray-600 border-gray-200 cursor-help">
                            Note
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{notes}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>

              {/* Line Items Drawer */}
              {hasLineItems && isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4 lg:pl-20 lg:pr-8 animate-in slide-in-from-top-2 duration-200">
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 rounded-full lg:-ml-6"></div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="pb-2 pl-4">Description</th>
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.lineItems?.map((item, idx) => (
                          <tr key={idx} className="group/item">
                            <td className="py-2 pl-4 text-gray-700 group-hover/item:text-turquoise-700 transition-colors">
                              {item.description}
                            </td>
                            <td className="py-2 text-gray-500">{item.date || '-'}</td>
                            <td className="py-2 text-gray-500">
                              <span className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs">
                                {item.category || 'General'}
                              </span>
                            </td>
                            <td className="py-2 text-right font-mono text-gray-700">{item.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {showFlaggedOnly && filteredData.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
            <Shield className="h-8 w-8 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">All Clear!</h3>
          <p className="text-gray-500 max-w-sm mx-auto mt-2">
            No flagged receipts found. Your expenses look compliant and clean.
          </p>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={() => setShowFlaggedOnly(false)}
          >
            Show All Receipts
          </Button>
        </div>
      )}
    </div>
  );
};
