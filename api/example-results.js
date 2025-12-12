/**
 * Pre-extracted results for example receipts
 * These are hardcoded so examples work immediately without cache files or API calls
 */

// Example receipt extraction results
// Format: { filename: { csv: string, lineItems: array } }
export const EXAMPLE_RESULTS = {
  'fake-receipt.png': {
    csv: ',2024-01-15,125.50,USD,Test Store,Card,High,No,No,No,',
    lineItems: []
  },
  'restaurant-receipt.jpeg': {
    csv: 'REST-001,2024-01-20,89.75,USD,Restaurant Name,Card,Low,No,No,No,',
    lineItems: [
      { invoiceNumber: 'REST-001', description: 'Main Course', date: '2024-01-20', amount: '45.00', category: 'food' },
      { invoiceNumber: 'REST-001', description: 'Appetizer', date: '2024-01-20', amount: '18.50', category: 'food' },
      { invoiceNumber: 'REST-001', description: 'Dessert', date: '2024-01-20', amount: '12.25', category: 'food' },
      { invoiceNumber: 'REST-001', description: 'Beverages', date: '2024-01-20', amount: '14.00', category: 'food' }
    ]
  },
  'alcohol example.png': {
    csv: 'LIQ-2024-001,2024-01-18,45.99,USD,Liquor Store,Card,Low,No,Yes,No,Flag for policy violation - require approver',
    lineItems: [
      { invoiceNumber: 'LIQ-2024-001', description: 'Wine Bottle', date: '2024-01-18', amount: '25.99', category: 'alcohol' },
      { invoiceNumber: 'LIQ-2024-001', description: 'Beer 6-pack', date: '2024-01-18', amount: '20.00', category: 'alcohol' }
    ]
  },
  'software.png': {
    csv: 'SW-20240115,2024-01-15,299.00,USD,Software Company,Invoice,Low,No,No,No,',
    lineItems: [
      { invoiceNumber: 'SW-20240115', description: 'Software License', date: '2024-01-15', amount: '299.00', category: 'software' }
    ]
  },
  'hotel-receipt copy.png': {
    csv: 'HOTEL-12345,2024-01-22,450.00,USD,Grand Hotel,Card,Low,No,No,No,',
    lineItems: [
      { invoiceNumber: 'HOTEL-12345', description: 'Room Night', date: '2024-01-22', amount: '350.00', category: 'lodging' },
      { invoiceNumber: 'HOTEL-12345', description: 'Room Service', date: '2024-01-22', amount: '75.00', category: 'food' },
      { invoiceNumber: 'HOTEL-12345', description: 'Parking', date: '2024-01-22', amount: '25.00', category: 'transport' }
    ]
  },
  'grocery-receipt.jpeg': {
    csv: 'GROC-20240119,2024-01-19,156.43,USD,Grocery Store,Card,Low,No,No,No,',
    lineItems: [
      { invoiceNumber: 'GROC-20240119', description: 'Produce', date: '2024-01-19', amount: '45.20', category: 'food' },
      { invoiceNumber: 'GROC-20240119', description: 'Dairy', date: '2024-01-19', amount: '32.15', category: 'food' },
      { invoiceNumber: 'GROC-20240119', description: 'Meat', date: '2024-01-19', amount: '48.90', category: 'food' },
      { invoiceNumber: 'GROC-20240119', description: 'Other', date: '2024-01-19', amount: '30.18', category: 'food' }
    ]
  },
  'amazon.png': {
    csv: 'AMZ-1234567890,2024-01-17,89.99,USD,Amazon,Invoice,Low,No,No,No,',
    lineItems: [
      { invoiceNumber: 'AMZ-1234567890', description: 'Product A', date: '2024-01-17', amount: '89.99', category: 'other' }
    ]
  },
  'google ads.png': {
    csv: 'GA-20240116,2024-01-16,500.00,USD,Google Ads,Invoice,Low,No,No,No,',
    lineItems: [
      { invoiceNumber: 'GA-20240116', description: 'Ad Campaign', date: '2024-01-16', amount: '500.00', category: 'advertising' }
    ]
  },
  'transport-receipt.png': {
    csv: 'UBER-789012,2024-01-21,28.50,USD,Uber,Card,Low,No,No,No,',
    lineItems: [
      { invoiceNumber: 'UBER-789012', description: 'Ride', date: '2024-01-21', amount: '28.50', category: 'transport' }
    ]
  }
};

/**
 * Get example result by filename (with normalization)
 */
export function getExampleResult(filename) {
  // Normalize filename for lookup
  const normalize = (str) => {
    const basename = str.includes('/') ? str.split('/').pop() : str;
    return basename.toLowerCase().replace(/\s+/g, '-');
  };
  
  const normalized = normalize(filename);
  
  // Try exact match first
  if (EXAMPLE_RESULTS[filename]) {
    return EXAMPLE_RESULTS[filename];
  }
  
  // Try normalized match
  for (const [key, value] of Object.entries(EXAMPLE_RESULTS)) {
    if (normalize(key) === normalized) {
      return value;
    }
  }
  
  return null;
}

