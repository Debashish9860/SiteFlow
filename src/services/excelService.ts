import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Bill, BusinessProfile } from '../types/bill';
import { formatDate } from '../utils/formatters';
import { numberToWordsIndian } from '../utils/numberToWords';

export async function exportBillToExcel(bill: Bill, profile: BusinessProfile): Promise<string> {
  const isQuotation = bill.billType === 'quotation';
  const docTitle = isQuotation ? 'QUOTATION' : 'INVOICE';
  const billedName = (bill.billedBy || profile.ownerName || 'RAMESH RAUT').toUpperCase();
  const billedTitle = (bill.billedByTitle || profile.contractorTitle || 'PLUMBING & CIVIL WORKS CONTRACTOR').toUpperCase();
  const contactPhone = bill.billedByPhone || profile.phone || '+91 9860980626';
  const contactAddress = bill.billedByAddress || profile.address || 'Sus, Pune - 411021';
  const totalAmount = bill.subtotal - (bill.discount || 0);
  const words = numberToWordsIndian(totalAmount);

  // Format date
  let formattedDate = bill.date;
  try {
    const parts = bill.date.split('-');
    if (parts.length === 3) {
      formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else {
      formattedDate = formatDate(bill.date);
    }
  } catch {
    formattedDate = bill.date;
  }

  // Build Sheet Data Rows (AOA - Array of Arrays)
  const rows: any[][] = [
    // Header Banner
    [billedName, '', '', '', '', docTitle],
    [billedTitle, '', '', '', '', ''],
    [`Contact: ${contactPhone} | Address: ${contactAddress}`, '', '', '', '', ''],
    [],
    // Client & Document Info
    ['BILLED TO (CLIENT):', bill.customerName, '', 'DATE:', formattedDate, ''],
    [
      'SITE / PROJECT:',
      `${bill.siteLocation || '—'}${bill.siteCity ? ', ' + bill.siteCity : ''}`,
      '',
      isQuotation ? 'QUOTATION NO:' : 'BILL NO:',
      bill.billNumber || '—',
      '',
    ],
    [],
    // Table Header
    ['SR.', 'DESCRIPTION OF WORK / PARTICULAR', 'RATE (₹)', 'QTY', 'UNIT', 'AMOUNT (₹)'],
  ];

  // Add Item Rows
  bill.items.forEach((item, index) => {
    const desc = item.subDescription ? `${item.name} (${item.subDescription})` : item.name;
    rows.push([
      index + 1,
      desc,
      item.rate || 0,
      item.quantity || 1,
      item.unit || 'pcs',
      item.amount || 0,
    ]);
  });

  // Totals & Words
  rows.push([]);
  rows.push(['TOTAL AMOUNT IN WORDS:', words, '', '', 'GRAND TOTAL (₹):', totalAmount]);
  if (!isQuotation && (bill.discount > 0 || bill.advancePaid > 0)) {
    if (bill.discount > 0) {
      rows.push(['', '', '', '', 'DISCOUNT (₹):', bill.discount]);
    }
    if (bill.advancePaid > 0) {
      rows.push(['', '', '', '', 'ADVANCE PAID (₹):', bill.advancePaid]);
    }
    rows.push(['', '', '', '', 'BALANCE DUE (₹):', bill.balanceDue]);
  }

  // Footer
  rows.push([]);
  rows.push(['Thank you for your business!', '', '', '', `For ${billedName}`, '']);
  rows.push(['', '', '', '', 'Authorized Signatory', '']);

  // Create Worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Setup merges for clean letterhead layout
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Billed Name (A1:E1)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Contractor Subtitle (A2:F2)
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }, // Contact & Address (A3:F3)
    { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } }, // Client Name (B5:C5)
    { s: { r: 5, c: 1 }, e: { r: 5, c: 2 } }, // Site Info (B6:C6)
  ];

  // Merge the "Total in words" span
  const wordsRowIdx = 7 + bill.items.length + 1;
  merges.push({ s: { r: wordsRowIdx, c: 1 }, e: { r: wordsRowIdx, c: 3 } });

  ws['!merges'] = merges;

  // Column widths
  ws['!cols'] = [
    { wch: 6 },  // SR
    { wch: 45 }, // Description
    { wch: 12 }, // Rate
    { wch: 8 },  // Qty
    { wch: 10 }, // Unit
    { wch: 16 }, // Amount
  ];

  // Create Workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isQuotation ? 'Quotation' : 'Invoice');

  const cleanCustomerName = (bill.customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `${isQuotation ? 'Quotation' : 'Invoice'}_${cleanCustomerName}_${bill.billNumber || Date.now()}.xlsx`;

  if (Platform.OS === 'web') {
    // Web environment: write binary and trigger download
    XLSX.writeFile(wb, fileName);
    return fileName;
  } else {
    // Native Mobile (Android / iOS): write base64 to FileSystem and share
    const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Export ${isQuotation ? 'Quotation' : 'Invoice'} to Excel`,
        UTI: 'com.microsoft.excel.xlsx',
      });
    }
    return fileUri;
  }
}
