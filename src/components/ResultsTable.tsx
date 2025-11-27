import { Download, FileText, Calendar, DollarSign, Building, Tag, AlertTriangle, Copy, Wine, ShoppingBag, Shield, AlertCircle, ChevronDown, ChevronRight, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { trackEvent, Events } from "@/utils/posthogEvents";

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
  receiptImage?: string; // Blob URL or data URL for receipt image
  [key: string]: string | LineItem[] | undefined;
}

interface ResultsTableProps {
  data: ReceiptData[];
  receiptImages?: Map<string, string>; // Map of invoice number to image URL
}

export const ResultsTable = ({ data, receiptImages }: ResultsTableProps) => {
  if (data.length === 0) return null;

  // Initialize with all rows that have line items already expanded
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

  // Update expanded rows when data changes (e.g., new receipts added)
  useEffect(() => {
    const newExpanded = new Set<number>();
    data.forEach((row, index) => {
      if (row.lineItems && row.lineItems.length > 0) {
        newExpanded.add(index);
      }
    });
    // Only update if there are changes
    const currentSize = expandedRows.size;
    const newSize = newExpanded.size;
    const hasChanges = currentSize !== newSize || 
      Array.from(newExpanded).some(idx => !expandedRows.has(idx));
    
    if (hasChanges) {
      setExpandedRows(newExpanded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]); // Only update when number of receipts changes

  const toggleRow = (index: number) => {
    const isExpanding = !expandedRows.has(index);
    trackEvent(isExpanding ? Events.ROW_EXPANDED : Events.ROW_COLLAPSED, {
      row_index: index,
      has_line_items: data[index]?.lineItems?.length > 0,
      line_item_count: data[index]?.lineItems?.length || 0
    });
    
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  // Helper function to check if row has any flags
  const hasAnyFlagCheck = (row: ReceiptData) => {
    const isDuplicate = row["Duplicate"]?.toLowerCase() === 'yes';
    const fraudRisk = row["Fraud Risk"]?.toLowerCase() || 'low';
    const hasAlcoholTobacco = row["Alcohol/Tobacco"]?.toLowerCase() === 'yes';
    const hasPersonalExpense = row["Personal Expense"]?.toLowerCase().includes('suspicious');
    return isDuplicate || (fraudRisk === 'high' || fraudRisk === 'medium') || hasAlcoholTobacco || hasPersonalExpense;
  };

  // Updated duplicate detection - now uses the "Duplicate" column
  const duplicateCount = data.filter(row => row["Duplicate"]?.toLowerCase() === 'yes').length;
  const hasDuplicates = duplicateCount > 0;
  const fraudRiskCount = data.filter(row => row["Fraud Risk"]?.toLowerCase() === 'high' || row["Fraud Risk"]?.toLowerCase() === 'medium').length;
  const alcoholTobaccoCount = data.filter(row => row["Alcohol/Tobacco"]?.toLowerCase() === 'yes').length;
  const personalExpenseCount = data.filter(row => row["Personal Expense"]?.toLowerCase().includes('suspicious')).length;
  
  // Filter data based on showFlaggedOnly
  const filteredData = showFlaggedOnly ? data.filter(hasAnyFlagCheck) : data;
  const flaggedCount = data.filter(hasAnyFlagCheck).length;

  return (
    <div className="space-y-6">
      {/* 1. SUMMARY STATS - First */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="mesh-card p-4 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-turquoise-100 to-turquoise-200 rounded-xl flex items-center justify-center mx-auto mb-3">
            <FileText className="h-6 w-6 text-turquoise-600" />
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-gray-800">{data.length}</h3>
          <p className="text-base md:text-lg text-gray-600">Receipts Processed</p>
        </div>
        
        <div className="mesh-card p-4 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center mx-auto mb-3">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">
            {data.reduce((sum, row) => {
              const amount = parseFloat(row["Amount"]?.replace(/[^0-9.-]/g, '') || '0');
              return sum + amount;
            }, 0).toFixed(2)}
          </h3>
          <p className="text-base md:text-lg text-gray-600">Total Amount</p>
        </div>
        
        <div className="mesh-card p-4 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Building className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">
            {new Set(data.map(row => row["Merchant"])).size}
          </h3>
          <p className="text-base md:text-lg text-gray-600">Unique Merchants</p>
        </div>
      </div>

      {/* 2. POLICY VIOLATIONS - Single card with filter in header */}
      {(hasDuplicates || fraudRiskCount > 0 || alcoholTobaccoCount > 0 || personalExpenseCount > 0) && (
        <div className="bg-red-50 border-l-4 border-l-red-500 border border-red-200 rounded-xl p-4 md:p-6">
          {/* Header with filter button */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-red-900">Policy Violations Detected</h3>
                <p className="text-sm text-red-700">Review {flaggedCount} flagged expense{flaggedCount > 1 ? 's' : ''}</p>
              </div>
            </div>
            
            {/* Filter button in same row */}
            <Button
              onClick={() => {
                const newValue = !showFlaggedOnly;
                trackEvent(Events.FILTER_FLAGGED_TOGGLED, {
                  show_flagged_only: newValue,
                  total_receipts: data.length,
                  flagged_count: flaggedCount
                });
                setShowFlaggedOnly(newValue);
              }}
              size="sm"
              variant={showFlaggedOnly ? "default" : "outline"}
              className={`gap-2 flex-shrink-0 ${showFlaggedOnly ? "bg-red-600 hover:bg-red-700 text-white" : "bg-white border-red-400 text-red-700 hover:bg-red-100"}`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{showFlaggedOnly ? 'Show All' : 'Flagged Only'}</span>
            </Button>
          </div>

          {/* All violations as text lines */}
          <div className="space-y-2 text-base md:text-lg text-red-800">
            {hasDuplicates && (
              <div className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                <span>{duplicateCount} duplicate receipt{duplicateCount > 1 ? 's' : ''} found.</span>
              </div>
            )}
          {fraudRiskCount > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-red-600">•</span>
              <span>{fraudRiskCount} receipt{fraudRiskCount > 1 ? 's' : ''} flagged as Suspicious Fraud (AI-Generated).</span>
            </div>
          )}
            {alcoholTobaccoCount > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                <span>{alcoholTobaccoCount} receipt{alcoholTobaccoCount > 1 ? 's' : ''} contain{alcoholTobaccoCount === 1 ? 's' : ''} alcohol/tobacco.</span>
              </div>
            )}
            {personalExpenseCount > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-red-600">•</span>
                <span>{personalExpenseCount} suspicious personal expense{personalExpenseCount > 1 ? 's' : ''} detected.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile: Card Layout */}

      {/* Mobile: Card Layout */}
      <div className="block lg:hidden space-y-3 mb-6">
        {filteredData.map((row, index) => {
          const isDuplicate = row["Duplicate"]?.toLowerCase() === 'yes';
          const fraudRisk = row["Fraud Risk"]?.toLowerCase() || 'low';
          const hasAlcoholTobacco = row["Alcohol/Tobacco"]?.toLowerCase() === 'yes';
          const hasPersonalExpense = row["Personal Expense"]?.toLowerCase().includes('suspicious');
          const hasAnyFlag = isDuplicate || (fraudRisk === 'high' || fraudRisk === 'medium') || hasAlcoholTobacco || hasPersonalExpense;
          const invoiceNumber = row["Invoice Number"] || '';
          const receiptImageUrl = row.receiptImage || 
            (invoiceNumber ? receiptImages?.get(invoiceNumber) : receiptImages?.get(`receipt-${index}`));
          const notes = row["Notes"] || '';
          
          return (
            <div 
              key={`mobile-${index}`}
              className={`rounded-lg border p-4 ${hasAnyFlag ? 'bg-red-50 border-l-4 border-l-red-500 border-red-200' : 'bg-white border-gray-200'}`}
            >
              {/* Flags at top */}
              {hasAnyFlag && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {isDuplicate && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 rounded-md">
                      <img src="/sample-receipts/status-error-icon.png" className="h-3 w-3" alt="" />
                      <span className="text-xs font-semibold text-red-700">Duplicate</span>
                    </div>
                  )}
                  {(fraudRisk === 'high' || fraudRisk === 'medium') && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 rounded-md">
                      <img src="/sample-receipts/status-error-icon.png" className="h-3 w-3" alt="" />
                      <span className="text-xs font-semibold text-red-700">AI-Generated</span>
                    </div>
                  )}
                  {hasAlcoholTobacco && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 rounded-md">
                      <img src="/sample-receipts/status-error-icon.png" className="h-3 w-3" alt="" />
                      <span className="text-xs font-semibold text-red-700">Alcohol</span>
                    </div>
                  )}
                  {hasPersonalExpense && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 rounded-md">
                      <img src="/sample-receipts/status-error-icon.png" className="h-3 w-3" alt="" />
                      <span className="text-xs font-semibold text-red-700">Personal</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Main content */}
              <div className="flex gap-3">
                {/* Image */}
                {receiptImageUrl && (
                  <img 
                    src={receiptImageUrl}
                    alt="Receipt" 
                    className="w-20 h-24 object-cover rounded border border-gray-200 flex-shrink-0"
                    onClick={() => {
                      trackEvent(Events.RECEIPT_IMAGE_VIEWED, {
                        invoice_number: invoiceNumber || `receipt-${index}`,
                        view_type: 'mobile'
                      });
                      
                      const img = document.createElement('img');
                      img.src = receiptImageUrl;
                      img.style.maxWidth = '90vw';
                      img.style.maxHeight = '90vh';
                      img.style.objectFit = 'contain';
                      const modal = document.createElement('div');
                      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer';
                      modal.appendChild(img);
                      document.body.appendChild(modal);
                      modal.onclick = () => document.body.removeChild(modal);
                    }}
                  />
                )}
                
                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-base ${hasAnyFlag ? 'text-red-800' : 'text-gray-800'} mb-1 truncate`}>
                    {row["Merchant"] || 'Unknown'}
                  </div>
                  <div className={`text-lg font-bold ${hasAnyFlag ? 'text-red-700' : 'text-turquoise-600'}`}>
                    {row["Amount"]} {row["Currency"]}
                  </div>
                  <div className={`text-sm ${hasAnyFlag ? 'text-red-600' : 'text-gray-600'} mt-1`}>
                    {row["Date"] || 'N/A'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    {row["Invoice Number"] || 'No invoice #'}
                  </div>
                </div>
              </div>
              
              {/* Notes */}
              {notes && (
                <div className="mt-3 text-xs text-gray-600 border-t border-gray-200 pt-2">
                  {notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state when filter applied */}
      {showFlaggedOnly && filteredData.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p className="text-lg font-medium">No flagged expenses found</p>
          <p className="text-sm mt-2">All receipts passed validation checks</p>
        </div>
      )}

      {/* Desktop: Table Layout */}
      <div className="hidden lg:block">
      <div className="mesh-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold text-gray-700 w-12"></TableHead>
                <TableHead className="font-semibold text-gray-700 w-24" style={{ minWidth: '80px', maxWidth: '120px' }}>
                  {/* Receipt Image Column - no header */}
                </TableHead>
                <TableHead className="font-semibold text-gray-700 text-base md:text-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-turquoise-600" />
                    Invoice Number
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-700 text-base md:text-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-turquoise-600" />
                    Date
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-700 text-base md:text-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-turquoise-600" />
                    Amount
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-700 text-base md:text-lg">Currency</TableHead>
                <TableHead className="font-semibold text-gray-700 text-base md:text-lg">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-turquoise-600" />
                    Merchant
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-700 text-base md:text-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-turquoise-600" />
                    Notes
                  </div>
                </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              <TooltipProvider delayDuration={300}>
                {filteredData.map((row, index) => {
                  const isDuplicate = row["Duplicate"]?.toLowerCase() === 'yes';
                  const fraudRisk = row["Fraud Risk"]?.toLowerCase() || 'low';
                  const hasAlcoholTobacco = row["Alcohol/Tobacco"]?.toLowerCase() === 'yes';
                  const hasPersonalExpense = row["Personal Expense"]?.toLowerCase().includes('suspicious');
                  const hasLineItems = row.lineItems && row.lineItems.length > 0;
                  const isExpanded = expandedRows.has(index);
                  
                  // Detect ANY flag (all flags should be red)
                  const hasAnyFlag = isDuplicate || (fraudRisk === 'high' || fraudRisk === 'medium') || hasAlcoholTobacco || hasPersonalExpense;
                  
                  // Get receipt image URL
                  const invoiceNumber = row["Invoice Number"] || '';
                  const receiptImageUrl = row.receiptImage || 
                    (invoiceNumber ? receiptImages?.get(invoiceNumber) : receiptImages?.get(`receipt-${index}`));
                  
                  // Get notes from backend
                  const notes = row["Notes"] || '';
                  
                  // Color scheme: ALL flagged items get red styling
                  const rowColor = hasAnyFlag ? 'bg-red-50 border-red-200' : '';
                  const textColor = hasAnyFlag ? 'text-red-800' : 'text-gray-800';
                  const textColorSecondary = hasAnyFlag ? 'text-red-600' : 'text-gray-600';
                  const borderLeft = hasAnyFlag ? 'border-l-4 border-l-red-500' : '';
                  
                  return (
                    <>
                      {/* Parent Row */}
                      <TableRow 
                        key={`parent-${index}`}
                        className={`hover:bg-gray-50 mesh-transition-fast border-b border-gray-100 ${rowColor} ${borderLeft}`}
                      >
                        <TableCell>
                          {hasLineItems && (
                            <button
                              onClick={() => toggleRow(index)}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              aria-label={isExpanded ? "Collapse line items" : "Expand line items"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-600" />
                              )}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="p-2">
                          {receiptImageUrl ? (
                            <div className="relative group">
                              <img 
                                src={receiptImageUrl} 
                                alt={`Receipt ${invoiceNumber || index + 1}`}
                                className="w-16 h-20 object-cover rounded border border-gray-200 cursor-pointer hover:border-turquoise-400 transition-colors"
                                style={{ resize: 'both', minWidth: '60px', minHeight: '80px', maxWidth: '120px', maxHeight: '150px' }}
                                onClick={(e) => {
                                  // Track image view
                                  trackEvent(Events.RECEIPT_IMAGE_VIEWED, {
                                    invoice_number: invoiceNumber || `receipt-${index}`
                                  });
                                  
                                  // Open image in modal or new tab
                                  const img = document.createElement('img');
                                  img.src = receiptImageUrl;
                                  img.style.maxWidth = '90vw';
                                  img.style.maxHeight = '90vh';
                                  img.style.objectFit = 'contain';
                                  
                                  const modal = document.createElement('div');
                                  modal.style.position = 'fixed';
                                  modal.style.top = '0';
                                  modal.style.left = '0';
                                  modal.style.width = '100%';
                                  modal.style.height = '100%';
                                  modal.style.backgroundColor = 'rgba(0,0,0,0.9)';
                                  modal.style.display = 'flex';
                                  modal.style.alignItems = 'center';
                                  modal.style.justifyContent = 'center';
                                  modal.style.zIndex = '9999';
                                  modal.style.cursor = 'pointer';
                                  
                                  modal.appendChild(img);
                                  document.body.appendChild(modal);
                                  
                                  modal.onclick = () => {
                                    document.body.removeChild(modal);
                                  };
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                              No image
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={`font-medium ${textColor} text-base md:text-lg`}>
                          {row["Invoice Number"] || '-'}
                        </TableCell>
                        <TableCell className={`${textColorSecondary} text-base md:text-lg`}>
                          {row["Date"] || 'N/A'}
                        </TableCell>
                        <TableCell className={`font-semibold ${textColor} text-base md:text-lg`}>
                          {row["Amount"] || 'N/A'}
                        </TableCell>
                        <TableCell className={`${textColorSecondary} text-base md:text-lg`}>
                          {row["Currency"] || 'N/A'}
                </TableCell>
                        <TableCell className={`${hasAnyFlag ? 'text-red-700 font-semibold' : 'text-gray-700'} text-base md:text-lg`}>
                          {row["Merchant"]?.replace("DUPLICATE RECEIPT UPLOADED", "").trim() || row["Merchant"] || 'N/A'}
                </TableCell>
                        <TableCell>
                          {/* Show flag badges with text labels */}
                          {(isDuplicate || fraudRisk === 'high' || fraudRisk === 'medium' || hasAlcoholTobacco || hasPersonalExpense || notes) ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Flag badges - all red with text labels */}
                              {isDuplicate && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 rounded-md">
                                  <img 
                                    src="/sample-receipts/status-error-icon.png" 
                                    alt="Duplicate" 
                                    className="h-4 w-4"
                                  />
                                  <span className="text-xs font-semibold text-red-700">Duplicate</span>
                                </div>
                              )}
                              {(fraudRisk === 'high' || fraudRisk === 'medium') && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 rounded-md">
                                  <img 
                                    src="/sample-receipts/status-error-icon.png" 
                                    alt="Suspicious Fraud (AI-Generated)" 
                                    className="h-4 w-4"
                                  />
                                  <span className="text-xs font-semibold text-red-700">
                                    AI-Generated
                                  </span>
                                </div>
                              )}
                              {hasAlcoholTobacco && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 rounded-md">
                                  <img 
                                    src="/sample-receipts/status-error-icon.png" 
                                    alt="Alcohol/Tobacco" 
                                    className="h-4 w-4"
                                  />
                                  <span className="text-xs font-semibold text-red-700">Alcohol</span>
                                </div>
                              )}
                              {hasPersonalExpense && (
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 rounded-md">
                                  <img 
                                    src="/sample-receipts/status-error-icon.png" 
                                    alt="Personal Expense" 
                                    className="h-4 w-4"
                                  />
                                  <span className="text-xs font-semibold text-red-700">Personal</span>
                                </div>
                              )}
                              {/* Notes text */}
                              {notes && (
                                <span className="text-xs text-gray-600 truncate max-w-[150px] sm:max-w-xs" title={notes}>
                                  {notes}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-base md:text-lg">-</span>
                          )}
                </TableCell>
                      </TableRow>
                      
                      {/* Line Items Rows */}
                      {hasLineItems && isExpanded && row.lineItems?.map((lineItem, itemIndex) => (
                        <TableRow 
                          key={`line-${index}-${itemIndex}`}
                          className={`${rowColor} border-b border-gray-100`}
                        >
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell className={`text-base md:text-lg ${textColorSecondary} pl-8`}>
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                              {lineItem.description}
                            </div>
                          </TableCell>
                          <TableCell className={`text-base md:text-lg ${textColorSecondary}`}>
                            {lineItem.date || row["Date"] || 'N/A'}
                          </TableCell>
                          <TableCell className={`text-base md:text-lg font-medium ${textColor}`}>
                            {lineItem.amount}
                          </TableCell>
                          <TableCell className={`text-base md:text-lg ${textColorSecondary}`}>
                            {row["Currency"] || 'N/A'}
                          </TableCell>
                          <TableCell className={`text-base md:text-lg ${textColorSecondary}`}>
                            {lineItem.category || '-'}
                          </TableCell>
                          <TableCell></TableCell>
              </TableRow>
            ))}
                    </>
                  );
                })}
              </TooltipProvider>
          </TableBody>
        </Table>
        </div>
      </div>
      </div>
    </div>
  );
};
