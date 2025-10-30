import { Download, FileText, Calendar, DollarSign, Building, Tag } from "lucide-react";
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

export interface ReceiptData {
  "Invoice Number": string;
  "Date": string;
  "Amount": string;
  "Currency": string;
  "Merchant": string;
  "Transaction Type": string;
  [key: string]: string;
}

interface ResultsTableProps {
  data: ReceiptData[];
}

export const ResultsTable = ({ data }: ResultsTableProps) => {
  if (data.length === 0) return null;

  const duplicateCount = data.filter(row => row["Merchant"]?.includes("DUPLICATE RECEIPT UPLOADED")).length;
  const hasDuplicates = duplicateCount > 0;

  return (
    <div className="space-y-6">
      {/* Duplicate Warning */}
      {hasDuplicates && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 font-bold">!</span>
            </div>
            <div>
              <h3 className="font-semibold text-red-800">Duplicate Receipts Detected</h3>
              <p className="text-sm text-red-600">
                {duplicateCount} duplicate receipt{duplicateCount > 1 ? 's' : ''} found. Please review the red highlighted rows below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="mesh-card p-4 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-turquoise-100 to-turquoise-200 rounded-xl flex items-center justify-center mx-auto mb-3">
            <FileText className="h-6 w-6 text-turquoise-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">{data.length}</h3>
          <p className="text-sm text-gray-600">Receipts Processed</p>
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
          <p className="text-sm text-gray-600">Total Amount</p>
        </div>
        
        <div className="mesh-card p-4 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Building className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">
            {new Set(data.map(row => row["Merchant"])).size}
          </h3>
          <p className="text-sm text-gray-600">Unique Merchants</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="mesh-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold text-gray-700">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-turquoise-600" />
                    Invoice Number
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-turquoise-600" />
                    Date
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-turquoise-600" />
                    Amount
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-700">Currency</TableHead>
                <TableHead className="font-semibold text-gray-700">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-turquoise-600" />
                    Merchant
                  </div>
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-turquoise-600" />
                    Transaction Type
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => {
                const isDuplicate = row["Merchant"]?.includes("DUPLICATE RECEIPT UPLOADED");
                return (
                  <TableRow 
                    key={index} 
                    className={`hover:bg-gray-50 mesh-transition-fast border-b border-gray-100 ${
                      isDuplicate ? 'bg-red-50 border-red-200' : ''
                    }`}
                  >
                    <TableCell className={`font-medium ${isDuplicate ? 'text-red-800' : 'text-gray-800'}`}>
                      {row["Invoice Number"] || '-'}
                    </TableCell>
                    <TableCell className={`${isDuplicate ? 'text-red-600' : 'text-gray-600'}`}>
                      {row["Date"] || 'N/A'}
                    </TableCell>
                    <TableCell className={`font-semibold ${isDuplicate ? 'text-red-800' : 'text-gray-800'}`}>
                      {row["Amount"] || 'N/A'}
                    </TableCell>
                    <TableCell className={`${isDuplicate ? 'text-red-600' : 'text-gray-600'}`}>
                      {row["Currency"] || 'N/A'}
                    </TableCell>
                    <TableCell className={`${isDuplicate ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>
                      {row["Merchant"] || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        isDuplicate 
                          ? 'bg-red-100 text-red-800 border border-red-200' 
                          : 'bg-turquoise-100 text-turquoise-800'
                      }`}>
                        {row["Transaction Type"] || 'N/A'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
