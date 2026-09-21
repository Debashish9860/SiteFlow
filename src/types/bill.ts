export type ItemCategory = 'plumbing' | 'civil' | 'labor' | 'material' | 'other';
export type BillType = 'invoice' | 'quotation';

export interface BillItem {
  id: string;
  name: string;
  subDescription?: string; // e.g. 'Labour charges', 'Fitting charges', etc.
  category: ItemCategory;
  quantity: number;
  unit: string; // 'Rft', 'Mtr', 'ft', 'pcs', 'nos', 'days', 'pts', 'sq.ft', 'lump-sum', 'bags', 'brass', etc.
  rate: number;
  amount: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  mode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | string;
  note?: string;
  taxDeduction?: number;
  isSettlement?: boolean;
  receivedAt: number;
}

export interface Bill {
  id: string;
  billNumber: string;
  billType: BillType; // 'invoice' | 'quotation'
  billedBy: string; // 'Ramesh Raut' | 'Rajeeb Raut' | other
  billedByTitle?: string; // 'PLUMBING & CIVIL WORKS CONTRACTOR'
  billedByPhone?: string; // '+91 9860980626'
  billedByAddress?: string; // 'Sus, Pune - 411021'
  date: string; // YYYY-MM-DD
  customerName: string;
  customerPhone?: string;
  siteLocation?: string; // e.g. 'Nigdi Site'
  siteCity?: string; // e.g. 'Pune, Maharashtra'
  items: BillItem[];
  subtotal: number;
  discount: number;
  advancePaid: number;
  balanceDue: number;
  taxDeducted?: number; // Tax/TDS or retention deducted by client
  isSettled?: boolean; // Fully settled/cleared
  settlementReason?: string; // Reason for balance deduction (e.g. 'TDS / Tax', 'Retention', 'Settled')
  notes?: string;
  paymentRecords?: PaymentRecord[];
  createdAt: number;
}

export interface BusinessProfile {
  businessName: string;
  ownerName: string; // Default: 'Ramesh Raut'
  contractorTitle: string; // 'PLUMBING & CIVIL WORKS CONTRACTOR'
  phone: string; // '+91 9860980626'
  altPhone?: string;
  address?: string; // 'Sus, Pune - 411021'
  upiId?: string;
  bankDetails?: string;
  noteFooter?: string;
}

export interface PresetCatalogItem {
  name: string;
  subDescription?: string;
  category: ItemCategory;
  defaultUnit: string;
  suggestedRate?: number;
}
