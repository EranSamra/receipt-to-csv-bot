# 🧾 Receipt Scanner - Updated Extraction Test

## ✅ **New Extraction Schema Implemented!**

The local server has been updated with a much more precise and deterministic extraction prompt that follows a standardized schema:

### 📊 **New CSV Schema**
```
Date,Amount,Currency,Merchant,Transaction Type
```

### 🎯 **Key Improvements**

1. **Deterministic Output**: Always returns the same format
2. **Standardized Fields**: Only 5 essential fields
3. **Better Date Handling**: YYYY-MM-DD format
4. **Currency Normalization**: ISO 4217 codes
5. **Transaction Type Mapping**: Clear categorization
6. **Merchant Normalization**: Removes legal suffixes

### 🧪 **Test Results**

**Test Input**: `test-receipt.txt`
**Output**: 
```csv
Date,Amount,Currency,Merchant,Transaction Type
2023-07-15,21.50,USD,Starbucks,Card
2023-07-16,10.00,USD,McDonalds,Cash
2023-07-17,5.00,EUR,Kamps,Card
```

### 🔧 **Transaction Type Mapping**

| Input | Output |
|-------|--------|
| Visa, Mastercard, Amex | Card |
| Cash, paid in cash | Cash |
| Bank transfer, ACH, SEPA | Wire |
| Internal account transfer | Transfer |
| Invoice to be paid | Invoice |
| Refund receipt | Refund |
| Store credit | Credit |
| Debit card | Debit |
| Unclear | Other |

### 📝 **Extraction Rules**

- **One row per receipt**: Multiple receipts in one file = multiple rows
- **Use final total**: Prefer "Total" over subtotal + tax calculations
- **Normalize dates**: Convert to YYYY-MM-DD format
- **Strip symbols**: Remove currency symbols and thousand separators
- **Handle refunds**: Negative amounts for returns
- **Empty fields**: Leave blank if truly unknown

### 🚀 **Ready to Test**

The server is running with the new extraction prompt. You can test it by:

1. **HTML Client**: Open `test.html` in your browser
2. **API Direct**: Use curl or Postman
3. **React Client**: If you set up the React version

### 📊 **Expected Output Format**

For a typical receipt, you should now get clean, consistent output like:
```csv
Date,Amount,Currency,Merchant,Transaction Type
2024-01-15,25.50,USD,Coffee Shop,Card
2024-01-16,12.00,EUR,Bakery,Cash
```

This new schema is much more reliable and will give you consistent, structured data for your expense tracking!
