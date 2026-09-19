import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Bill, BusinessProfile } from '../types/bill';
import { formatDate } from '../utils/formatters';
import { numberToWordsIndian } from '../utils/numberToWords';

export function generateInvoiceHtml(bill: Bill, profile: BusinessProfile): string {
  const isQuotation = bill.billType === 'quotation';
  const billedName = (bill.billedBy || profile.ownerName || 'RAMESH RAUT').toUpperCase();
  const billedTitle = (bill.billedByTitle || profile.contractorTitle || 'PLUMBING & CIVIL WORKS CONTRACTOR').toUpperCase();
  const contactPhone = bill.billedByPhone || profile.phone || '+91 9860980626';
  const contactAddress = bill.billedByAddress || profile.address || 'Sus, Pune - 411021';
  
  const docTitle = isQuotation ? 'QUOTATION' : 'INVOICE';
  const docDetailsTitle = isQuotation ? 'QUOTATION DETAILS' : 'INVOICE DETAILS';
  const docNumberLabel = isQuotation ? 'Quotation No:' : 'Bill No:';

  const totalAmount = bill.subtotal - (bill.discount || 0);
  const amountInWords = numberToWordsIndian(totalAmount);

  // Format date as DD/MM/YYYY or readable
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

  const itemsRows = bill.items
    .map((item, index) => {
      const qtyRateFormula =
        item.quantity > 0 && item.rate > 0
          ? `${item.quantity} ${item.unit} × ₹${item.rate.toLocaleString('en-IN')}/-`
          : '';
      return `
      <tr style="border-bottom: 1px solid #E2E8F0; background-color: ${index % 2 === 0 ? '#FFFFFF' : '#FBFDFE'};">
        <td style="padding: 14px 8px; text-align: center; vertical-align: top; color: #334155; font-size: 13px; font-weight: 500;">
          ${index + 1}
        </td>
        <td style="padding: 14px 16px; text-align: left; vertical-align: top;">
          <div style="font-weight: 700; color: #0F172A; font-size: 13px; line-height: 1.4;">
            ${item.name}
          </div>
          ${
            qtyRateFormula
              ? `<div style="font-size: 11px; color: #7C1034; font-weight: 600; margin-top: 3px;">${qtyRateFormula}</div>`
              : ''
          }
          ${
            item.subDescription
              ? `<div style="font-size: 12px; color: #64748B; font-style: italic; margin-top: 2px; font-weight: 400;">${item.subDescription}</div>`
              : ''
          }
        </td>
        <td style="padding: 14px 16px; text-align: right; vertical-align: top; font-weight: 700; color: #0F172A; font-size: 14px; white-space: nowrap;">
          ${item.amount.toLocaleString('en-IN')}/-
        </td>
      </tr>
    `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${docTitle} - ${bill.customerName}</title>
        <style>
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            color: #0F172A;
            background-color: #FFFFFF;
            font-size: 13px;
            line-height: 1.4;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page-container {
            padding: 40px;
            max-width: 820px;
            margin: 0 auto;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header-banner {
            background-color: #7C1034;
            padding: 24px 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 4px;
          }
          .contractor-name {
            font-size: 26px;
            font-weight: 900;
            color: #FFFFFF;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            margin: 0;
          }
          .contractor-sub {
            font-size: 12px;
            font-weight: 700;
            color: #F5A623;
            letter-spacing: 1.2px;
            margin-top: 6px;
            text-transform: uppercase;
          }
          .doc-type {
            font-size: 32px;
            font-weight: 900;
            color: #FFFFFF;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            margin: 0;
          }
          .meta-section {
            display: flex;
            justify-content: space-between;
            margin-top: 32px;
            margin-bottom: 28px;
            gap: 32px;
          }
          .site-column {
            flex: 1;
          }
          .details-column {
            flex: 1;
            text-align: left;
            padding-left: 20px;
          }
          .column-title {
            font-size: 13px;
            font-weight: 800;
            color: #7C1034;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin-bottom: 8px;
          }
          .site-title-underline {
            display: inline-block;
            border-bottom: 2px solid #7C1034;
            padding-bottom: 3px;
          }
          .site-name {
            font-size: 15px;
            font-weight: 700;
            color: #0F172A;
            margin-bottom: 4px;
          }
          .site-address {
            font-size: 13px;
            color: #475569;
            line-height: 1.4;
          }
          .detail-row {
            font-size: 13px;
            color: #0F172A;
            margin-bottom: 4px;
          }
          .detail-row strong {
            color: #0F172A;
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            border: 1px solid #E2E8F0;
          }
          th {
            background-color: #283747;
            color: #FFFFFF;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            padding: 12px 14px;
          }
          .summary-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 24px;
            gap: 16px;
          }
          .words-box {
            flex: 1;
            background-color: #FFFDF5;
            border-left: 4px solid #F5A623;
            padding: 12px 16px;
            border-radius: 2px;
          }
          .words-label {
            font-size: 10px;
            font-weight: 800;
            color: #D97706;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .words-val {
            font-size: 12px;
            font-weight: 800;
            color: #0F172A;
            text-transform: uppercase;
            line-height: 1.4;
          }
          .grand-total-wrap {
            display: flex;
            align-items: stretch;
            height: 48px;
          }
          .grand-total-label {
            background-color: #7C1034;
            color: #FFFFFF;
            font-weight: 900;
            font-size: 13px;
            letter-spacing: 1px;
            text-transform: uppercase;
            padding: 0 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .grand-total-val {
            border: 2px solid #7C1034;
            border-left: none;
            padding: 0 20px;
            font-size: 16px;
            font-weight: 900;
            color: #0F172A;
            display: flex;
            align-items: center;
            justify-content: center;
            white-space: nowrap;
          }
          .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 48px;
            padding-bottom: 16px;
          }
          .thank-you {
            font-size: 13px;
            color: #64748B;
            font-style: italic;
          }
          .signatory-box {
            text-align: center;
            min-width: 200px;
          }
          .for-contractor {
            font-size: 13px;
            font-weight: 800;
            color: #0F172A;
            margin-bottom: 40px;
            text-transform: uppercase;
          }
          .sign-line {
            border-top: 1px solid #94A3B8;
            padding-top: 6px;
            font-size: 12px;
            color: #64748B;
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div>
            <!-- Top Letterhead Banner -->
            <div class="header-banner">
              <div>
                <div class="contractor-name">${billedName}</div>
                <div class="contractor-sub">${billedTitle}</div>
              </div>
              <div>
                <div class="doc-type">${docTitle}</div>
              </div>
            </div>

            <!-- Meta Section (Two Column) -->
            <div class="meta-section">
              <div class="site-column">
                <div class="column-title">
                  <span class="site-title-underline">BILLED TO (CLIENT)</span>
                </div>
                <!-- Client Name in BOLD -->
                <div style="font-size: 16px; font-weight: 800; color: #0F172A; text-transform: uppercase; margin-bottom: 4px;">
                  ${bill.customerName}
                </div>
                <!-- Below client name, site name on the right side -->
                <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: baseline; padding-top: 6px; border-top: 1px dashed #CBD5E1;">
                  <span style="font-size: 11px; font-weight: 700; color: #7C1034; text-transform: uppercase;">Site / Project:</span>
                  <div style="text-align: right;">
                    <span style="font-size: 13px; font-weight: 700; color: #0F172A;">${bill.siteLocation || '—'}</span>
                    ${bill.siteCity ? `<div style="font-size: 11px; color: #64748B;">${bill.siteCity}</div>` : ''}
                  </div>
                </div>
              </div>

              <div class="details-column">
                <div class="column-title">${docDetailsTitle}</div>
                <div class="detail-row"><strong>Date:</strong> ${formattedDate}</div>
                <div class="detail-row"><strong>${docNumberLabel}</strong> ${bill.billNumber || '—'}</div>
                <div class="detail-row"><strong>Contact:</strong> ${contactPhone}</div>
                <div class="detail-row"><strong>Address:</strong> ${contactAddress}</div>
              </div>
            </div>

            <!-- Particulars Table -->
            <table>
              <thead>
                <tr>
                  <th style="width: 44px; text-align: center;">SR.</th>
                  <th style="text-align: left;">DESCRIPTION OF WORK / PARTICULAR</th>
                  <th style="width: 140px; text-align: right;">AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <!-- Totals & In-Words Section -->
            <div class="summary-section">
              <div class="words-box">
                <div class="words-label">TOTAL AMOUNT IN WORDS</div>
                <div class="words-val">${amountInWords}</div>
              </div>

              <div class="grand-total-wrap">
                <div class="grand-total-label">GRAND TOTAL</div>
                <div class="grand-total-val">₹ ${totalAmount.toLocaleString('en-IN')}/-</div>
              </div>
            </div>
          </div>

          <!-- Bottom Footer -->
          <div class="footer-section">
            <div class="thank-you">Thank you for your business!</div>
            <div class="signatory-box">
              <div class="for-contractor">For ${billedName}</div>
              <div class="sign-line">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function createPdfFile(bill: Bill, profile: BusinessProfile): Promise<string> {
  const html = generateInvoiceHtml(bill, profile);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });
  return uri;
}

export async function sharePdf(bill: Bill, profile: BusinessProfile): Promise<void> {
  const uri = await createPdfFile(bill, profile);
  const isAvailable = await Sharing.isAvailableAsync();
  const docType = bill.billType === 'quotation' ? 'Quotation' : 'Invoice';
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `${docType} for ${bill.customerName} (${bill.billNumber})`,
    });
  } else {
    throw new Error('Sharing is not available on this device');
  }
}

export async function printDirectly(bill: Bill, profile: BusinessProfile): Promise<void> {
  const html = generateInvoiceHtml(bill, profile);
  await Print.printAsync({
    html,
  });
}
