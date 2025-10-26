import { Download } from "lucide-react";
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
  source_filename: string;
  is_receipt: string;
  total_amount: string;
  vat_amount: string;
  currency_ISO_4217: string;
  merchant_name_localized: string;
  date_ISO_8601: string;
  is_month_explicit: string;
  receipt_id: string;
  merchant_address: string;
  document_language_ISO_639: string;
  all_totals: string;
  all_dates: string;
  spend_category: string;
  [key: string]: string;
}

interface ResultsTableProps {
  results: ReceiptData[];
  onDownloadCSV: () => void;
}

export const ResultsTable = ({ results, onDownloadCSV }: ResultsTableProps) => {
  if (results.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Extracted Receipt Data</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {results.length} receipt{results.length > 1 ? 's' : ''} processed
          </p>
        </div>
        <Button onClick={onDownloadCSV} className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50">
          <Download className="h-4 w-4" />
          ⬇️ Download CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Transaction Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{row["Invoice Number"]}</TableCell>
                <TableCell>{row["Date"]}</TableCell>
                <TableCell className="text-right font-semibold">
                  {row["Amount"]}
                </TableCell>
                <TableCell>{row["Currency"]}</TableCell>
                <TableCell>{row["Merchant"]}</TableCell>
                <TableCell>{row["Transaction Type"]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
