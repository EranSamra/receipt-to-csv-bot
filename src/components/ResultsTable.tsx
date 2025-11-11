import { Download, FileText, Calendar, DollarSign, Building, Tag, AlertTriangle, Copy, Wine, ShoppingBag, Shield, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
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
import { useState } from "react";

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

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  // Updated duplicate detection - now uses the "Duplicate" column
  const duplicateCount = data.filter(row => row["Duplicate"]?.toLowerCase() === 'yes').length;
  const hasDuplicates = duplicateCount > 0;
  const fraudRiskCount = data.filter(row => row["Fraud Risk"]?.toLowerCase() === 'high' || row["Fraud Risk"]?.toLowerCase() === 'medium').length;
  const alcoholTobaccoCount = data.filter(row => row["Alcohol/Tobacco"]?.toLowerCase() === 'yes').length;
  const personalExpenseCount = data.filter(row => row["Personal Expense"]?.toLowerCase().includes('suspicious')).length;

  return (
    <div className="space-y-6">
      {/* Anomaly Warnings */}
      {(hasDuplicates || fraudRiskCount > 0 || alcoholTobaccoCount > 0 || personalExpenseCount > 0) && (
        <div className="space-y-3">
          {hasDuplicates && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <Copy className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-800 text-base md:text-lg">Duplicate Receipts Detected</h3>
                  <p className="text-base md:text-lg text-red-600">
                    {duplicateCount} duplicate receipt{duplicateCount > 1 ? 's' : ''} found. Please review the red highlighted rows below.
                  </p>
                </div>
              </div>
            </div>
          )}
          {fraudRiskCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Shield className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-yellow-800 text-base md:text-lg">Suspicious Fraud Risk Detected</h3>
                  <p className="text-base md:text-lg text-yellow-600">
                    {fraudRiskCount} receipt{fraudRiskCount > 1 ? 's' : ''} flagged with medium or high fraud risk.
                  </p>
                </div>
              </div>
            </div>
          )}
          {(alcoholTobaccoCount > 0 || personalExpenseCount > 0) && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
        <div>
                  <h3 className="font-semibold text-orange-800 text-base md:text-lg">Policy Violations Detected</h3>
                  <p className="text-base md:text-lg text-orange-600">
                    {alcoholTobaccoCount > 0 && `${alcoholTobaccoCount} receipt${alcoholTobaccoCount > 1 ? 's' : ''} contain${alcoholTobaccoCount === 1 ? 's' : ''} alcohol/tobacco. `}
                    {personalExpenseCount > 0 && `${personalExpenseCount} suspicious personal expense${personalExpenseCount > 1 ? 's' : ''} detected.`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header Stats */}
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

      {/* Data Table */}
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
                {data.map((row, index) => {
                  const isDuplicate = row["Duplicate"]?.toLowerCase() === 'yes';
                  const fraudRisk = row["Fraud Risk"]?.toLowerCase() || 'low';
                  const hasAlcoholTobacco = row["Alcohol/Tobacco"]?.toLowerCase() === 'yes';
                  const hasPersonalExpense = row["Personal Expense"]?.toLowerCase().includes('suspicious');
                  const hasLineItems = row.lineItems && row.lineItems.length > 0;
                  const isExpanded = expandedRows.has(index);
                  
                  // Get receipt image URL
                  const invoiceNumber = row["Invoice Number"] || '';
                  const receiptImageUrl = row.receiptImage || 
                    (invoiceNumber ? receiptImages?.get(invoiceNumber) : receiptImages?.get(`receipt-${index}`));
                  
                  // Get notes from backend
                  const notes = row["Notes"] || '';
                  
                  // Color scheme for row and line items
                  const rowColor = isDuplicate ? 'bg-red-50 border-red-200' : '';
                  const textColor = isDuplicate ? 'text-red-800' : 'text-gray-800';
                  const textColorSecondary = isDuplicate ? 'text-red-600' : 'text-gray-600';
                  
                  return (
                    <>
                      {/* Parent Row */}
                      <TableRow 
                        key={`parent-${index}`}
                        className={`hover:bg-gray-50 mesh-transition-fast border-b border-gray-100 ${rowColor}`}
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
                        <TableCell className={`${isDuplicate ? 'text-red-700 font-semibold' : 'text-gray-700'} text-base md:text-lg`}>
                          {row["Merchant"]?.replace("DUPLICATE RECEIPT UPLOADED", "").trim() || row["Merchant"] || 'N/A'}
                </TableCell>
                        <TableCell>
                          {/* Show flag icons if any flags are detected, or show notes text */}
                          {(isDuplicate || fraudRisk === 'high' || fraudRisk === 'medium' || hasAlcoholTobacco || hasPersonalExpense || notes) ? (
                            <div className="flex items-center gap-2">
                              {/* Flag icons */}
                              {isDuplicate && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help flex items-center justify-center hover:opacity-80 transition-opacity">
                                      <img 
                                        src="/sample-receipts/status-error-icon.png" 
                                        alt="Duplicate" 
                                        className="h-5 w-5 pointer-events-none"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="start">
                                    <p>Suspicious: This receipt appears to be a duplicate</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {(fraudRisk === 'high' || fraudRisk === 'medium') && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help flex items-center justify-center hover:opacity-80 transition-opacity">
                                      <img 
                                        src="/sample-receipts/status-error-icon.png" 
                                        alt="Fraud Risk" 
                                        className="h-5 w-5 pointer-events-none"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="start">
                                    <p>{fraudRisk === 'high' 
                                      ? 'High fraud risk: Multiple suspicious patterns detected' 
                                      : 'Medium fraud risk: Some inconsistencies detected'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {hasAlcoholTobacco && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help flex items-center justify-center hover:opacity-80 transition-opacity">
                                      <img 
                                        src="/sample-receipts/status-error-icon.png" 
                                        alt="Alcohol/Tobacco" 
                                        className="h-5 w-5 pointer-events-none"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="start">
                                    <p>Contains alcohol or tobacco products</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {hasPersonalExpense && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help flex items-center justify-center hover:opacity-80 transition-opacity">
                                      <img 
                                        src="/sample-receipts/status-error-icon.png" 
                                        alt="Personal Expense" 
                                        className="h-5 w-5 pointer-events-none"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="start">
                                    <p>Suspicious: Merchant matches personal expense category</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {/* Notes text from backend */}
                              {notes && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="max-w-xs truncate cursor-help text-base md:text-lg text-gray-600">
                                      {notes}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-md">
                                    <p className="text-base md:text-lg">{notes}</p>
                                  </TooltipContent>
                                </Tooltip>
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
  );
};
