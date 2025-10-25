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
  merchant_name: string;
  merchant_tax_id: string;
  merchant_address: string;
  merchant_city: string;
  merchant_country: string;
  receipt_datetime_local: string;
  currency: string;
  subtotal_amount: string;
  tax_amount: string;
  tip_amount: string;
  total_amount: string;
  payment_method: string;
  last4_card: string;
  invoice_or_receipt_number: string;
  line_items_json: string;
  category_hint: string;
  notes: string;
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
              <TableHead>Merchant</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{row.source_filename}</TableCell>
                <TableCell>{row.merchant_name}</TableCell>
                <TableCell>{row.receipt_datetime_local}</TableCell>
                <TableCell>{row.currency}</TableCell>
                <TableCell className="text-right font-semibold">
                  {row.total_amount}
                </TableCell>
                <TableCell>
                  {row.payment_method}
                  {row.last4_card && ` ****${row.last4_card}`}
                </TableCell>
                <TableCell>{row.category_hint}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                  {row.notes}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
