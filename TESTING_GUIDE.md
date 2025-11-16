# Testing Guide - All Flag Detection Flows

## Overview
This guide covers testing all flagging scenarios to ensure proper detection.

## Test Flows

### 1. AI-Generated Receipt Detection
**Test file:** `AI-Generated Receipt` example or fake-receipt.png

**Expected flags:**
- ✅ Fraud Risk: Medium or High
- ✅ Badge: "AI-Generated"
- ✅ Notes: "Suspicious Fraud (AI-Generated) - Hold for manual review"

**What triggers it:**
- Perfect white background + no shadows
- Too perfect alignment/spacing
- Placeholder merchant names ("SHOP'S NAME", etc.)
- Generic items ("Item 1", "Product A")
- Missing camera EXIF data
- Round numbers only

**Test steps:**
1. Select "AI-Generated Receipt" from examples
2. Click "Extract Data"
3. Check output for red highlighting
4. Verify "AI-Generated" badge appears
5. Check notes column for fraud message

---

### 2. Alcohol/Tobacco Detection
**Test file:** `Alcohol Receipt` example or alcohol example.png

**Expected flags:**
- ✅ Alcohol/Tobacco: Yes
- ✅ Badge: "Alcohol"
- ✅ Policy Violations banner

**What triggers it:**
- Merchant keywords: liquor, bar, brewery, pub, wine shop
- Line item keywords: vodka, gin, rum, whiskey, tequila, beer, wine, spirits
- Semantic understanding of alcohol products

**Test steps:**
1. Select "Alcohol Receipt" from examples
2. Click "Extract Data"
3. Check Policy Violations section shows alcohol count
4. Verify "Alcohol" badge on flagged receipts
5. Check red left border on table rows

---

### 3. Duplicate Detection
**Test method:** Upload same receipt twice (different filenames OK)

**Expected flags:**
- ✅ Duplicate: Yes
- ✅ Badge: "Duplicate"
- ✅ Red background on both receipts
- ✅ Policy Violations banner shows duplicate count

**What triggers it:**
- Same invoice number
- OR same merchant + same date + same amount (normalized)

**Test steps:**
1. Upload a receipt (e.g., Amazon Receipt)
2. Upload the SAME receipt again with different filename
3. Click "Extract Data"
4. Both should show "Duplicate" badge
5. Policy Violations should show "X duplicate receipts found"

---

### 4. Personal Expense Detection
**Test keywords in merchant:** OnlyFans, Zara, H&M, Netflix, Spotify, Uber Eats

**Expected flags:**
- ✅ Personal Expense: Suspicious Personal
- ✅ Badge: "Personal"
- ✅ Policy Violations banner

**What triggers it:**
- Merchant matches personal brands (OnlyFans, Zara, Netflix, etc.)
- Line items indicate personal use (clothing, cosmetics, subscriptions)
- High confidence when exact vendor match

**Test steps:**
1. Create/upload receipt with personal merchant
2. Click "Extract Data"
3. Check for "Personal" badge
4. Verify Policy Violations section shows personal expense count

---

### 5. Multiple Flags on Single Receipt
**Test file:** Create receipt with multiple violations

**Expected:**
- Multiple badges on same receipt (e.g., "Duplicate" + "Alcohol" + "Personal")
- Red highlighting
- All flags counted in Policy Violations section

---

### 6. Filter Functionality
**Test steps:**
1. Process receipts with mixed flags (some flagged, some clean)
2. Click "Flagged Only" button
3. Verify only flagged receipts show
4. Click "Show All"
5. Verify all receipts reappear

---

## Expected Results Summary

| Test | Badge | Background | Border | Policy Violations |
|------|-------|------------|--------|-------------------|
| AI-Generated | "AI-Generated" | Red | Red left (4px) | "X flagged as Suspicious Fraud" |
| Duplicate | "Duplicate" | Red | Red left (4px) | "X duplicate receipts found" |
| Alcohol | "Alcohol" | Red | Red left (4px) | "X contain alcohol/tobacco" |
| Personal | "Personal" | Red | Red left (4px) | "X suspicious personal expense" |

## Console Logs to Check

### Successful AI Detection:
```
[Index] Duplicate detection complete: X duplicates found
✓ Duplicate found by invoice: #12345
✓ Duplicate found by merchant+date+amount: amazon on 2022-06-12
```

### Fraud Risk Logging:
Check API logs for:
- Gemini fraud risk confidence scores
- Evidence tokens detected
- Notes generated

## Common Issues

### AI Detection Not Working:
- Check console for Gemini response
- Verify prompt includes aggressive detection rules
- Check if confidence score is being calculated correctly

### Duplicate Not Detected:
- Verify merchant names match (case-insensitive)
- Check date format consistency
- Verify amount normalization

### Filter Not Working:
- Check `filteredData` vs `data` in ResultsTable
- Verify `showFlaggedOnly` state updates

## Testing Checklist

- [ ] AI-Generated Receipt → Flagged
- [ ] Alcohol Receipt → Flagged
- [ ] Duplicate (same file twice) → Both flagged
- [ ] Personal Expense → Flagged
- [ ] Clean Receipt → No flags
- [ ] Filter "Flagged Only" → Shows only flagged
- [ ] Filter "Show All" → Shows everything
- [ ] Mobile view → Cards display correctly
- [ ] Desktop view → Table with red borders
- [ ] Policy Violations section → Accurate counts

