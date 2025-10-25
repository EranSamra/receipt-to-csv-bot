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
          <h2 className="text-2xl font-bold">Extraction Results</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {results.length} receipt{results.length > 1 ? 's' : ''} processed
          </p>
        </div>
        <Button onClick={onDownloadCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Download CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Is Receipt</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">VAT</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Receipt ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{row.source_filename}</TableCell>
                <TableCell>{row.is_receipt === 'true' ? '✓' : '✗'}</TableCell>
                <TableCell>{row.merchant_name_localized}</TableCell>
                <TableCell>{row.date_ISO_8601}</TableCell>
                <TableCell>{row.currency_ISO_4217}</TableCell>
                <TableCell className="text-right font-semibold">
                  {row.total_amount}
                </TableCell>
                <TableCell className="text-right">
                  {row.vat_amount}
                </TableCell>
                <TableCell>{row.spend_category}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {row.receipt_id}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
