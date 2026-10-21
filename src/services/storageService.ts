import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bill, BusinessProfile, PaymentRecord } from '../types/bill';
import { triggerBackgroundCloudSync, recordBillDeletion, deleteBillInCloud } from './cloudSyncService';
import { CompressedStorage } from './compressedStorage';
import { computePaymentUpdate } from '../utils/billMath';

const BILLS_KEY = '@billmaker_bills';
const PROFILE_KEY = '@billmaker_profile';

const DEFAULT_PROFILE: BusinessProfile = {
  businessName: 'RAMESH RAUT',
  ownerName: 'Ramesh Raut',
  contractorTitle: 'PLUMBING & CIVIL WORKS CONTRACTOR',
  phone: '+91 9860980626',
  altPhone: '',
  address: 'Sus, Pune - 411021',
  upiId: '9860980626@upi',
  bankDetails: '',
  noteFooter: 'Thank you for your business!',
};

export async function getBills(): Promise<Bill[]> {
  try {
    const bills = await CompressedStorage.getItem<Bill[]>(BILLS_KEY);
    if (!bills || !Array.isArray(bills)) return [];
    // ensure billType and billedBy exist for older records
    return bills
      .map((b) => ({
        ...b,
        billType: b.billType || 'invoice',
        billedBy: b.billedBy || 'Ramesh Raut',
        billedByTitle: b.billedByTitle || 'PLUMBING & CIVIL WORKS CONTRACTOR',
        billedByPhone: b.billedByPhone || '+91 9860980626',
        billedByAddress: b.billedByAddress || 'Sus, Pune - 411021',
        paymentRecords: b.paymentRecords || [],
        items: Array.isArray(b.items) ? b.items : [],
        // Totals are summed straight out of these. A bill arriving from
        // another device without one turns an entire dashboard figure into
        // NaN, which formatCurrency then quietly renders as a confident zero.
        subtotal: Number(b.subtotal) || 0,
        discount: Number(b.discount) || 0,
        advancePaid: Number(b.advancePaid) || 0,
        balanceDue: Number(b.balanceDue) || 0,
        createdAt: Number(b.createdAt) || 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error fetching bills from storage:', error);
    return [];
  }
}

export async function saveBill(newBill: Bill): Promise<void> {
  try {
    const bills = await getBills();
    // Stamped on every write: sync keeps whichever copy of a bill was edited
    // last, and an unstamped edit is invisible to that comparison.
    const stamped: Bill = { ...newBill, updatedAt: Date.now() };
    const existingIndex = bills.findIndex((b) => b.id === stamped.id);
    if (existingIndex >= 0) {
      bills[existingIndex] = stamped;
    } else {
      bills.unshift(stamped);
    }
    await CompressedStorage.setItem(BILLS_KEY, bills);
    triggerBackgroundCloudSync();
  } catch (error) {
    console.error('Error saving bill:', error);
    throw error;
  }
}

export async function registerBillPayment(
  billId: string,
  amountReceived: number,
  mode: string = 'Cash',
  note?: string,
  options?: {
    taxDeducted?: number;
    markAsSettled?: boolean;
    settlementReason?: string;
  }
): Promise<Bill> {
  try {
    const bills = await getBills();
    const billIndex = bills.findIndex((b) => b.id === billId);
    if (billIndex === -1) {
      throw new Error('Bill not found');
    }

    const bill = bills[billIndex];
    const taxAmount = options?.taxDeducted || 0;
    const outcome = computePaymentUpdate(bill, {
      amountReceived,
      taxDeduction: taxAmount,
      markAsSettled: options?.markAsSettled,
    });

    const newRecord: PaymentRecord = {
      // A bare timestamp collides for two payments taken in the same
      // millisecond, and across two phones recording at once.
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      amount: amountReceived,
      date: new Date().toISOString().split('T')[0],
      mode: mode,
      note: note ? note.trim() : undefined,
      taxDeduction: taxAmount > 0 ? taxAmount : undefined,
      isSettlement: outcome.isSettled,
      receivedAt: Date.now(),
    };

    const updatedRecords = bill.paymentRecords ? [newRecord, ...bill.paymentRecords] : [newRecord];

    const updatedBill: Bill = {
      ...bill,
      advancePaid: outcome.totalPaid,
      balanceDue: outcome.balanceDue,
      taxDeducted: outcome.taxDeducted > 0 ? outcome.taxDeducted : undefined,
      isSettled: outcome.isSettled,
      settlementReason: options?.settlementReason || bill.settlementReason,
      paymentRecords: updatedRecords,
      updatedAt: Date.now(),
    };

    bills[billIndex] = updatedBill;
    await CompressedStorage.setItem(BILLS_KEY, bills);
    triggerBackgroundCloudSync();
    return updatedBill;
  } catch (error) {
    console.error('Error registering bill payment:', error);
    throw error;
  }
}

export async function updateBillPaymentStatus(
  billId: string,
  totalPaid: number
): Promise<Bill> {
  try {
    const bills = await getBills();
    const billIndex = bills.findIndex((b) => b.id === billId);
    if (billIndex === -1) {
      throw new Error('Bill not found');
    }

    const bill = bills[billIndex];
    const netTotal = Math.max(0, bill.subtotal - (bill.discount || 0));
    const validatedPaid = Math.max(0, Math.min(netTotal, totalPaid));
    const validatedDue = Math.max(0, netTotal - validatedPaid);

    const updatedBill: Bill = {
      ...bill,
      advancePaid: validatedPaid,
      balanceDue: validatedDue,
      updatedAt: Date.now(),
    };

    bills[billIndex] = updatedBill;
    await CompressedStorage.setItem(BILLS_KEY, bills);
    triggerBackgroundCloudSync();
    return updatedBill;
  } catch (error) {
    console.error('Error updating bill payment status:', error);
    throw error;
  }
}

export async function deleteBill(billId: string): Promise<void> {
  try {
    const bills = await getBills();
    const updated = bills.filter((b) => b.id !== billId);

    // Record the deletion before removing it locally. The bill also exists in the
    // shared cloud copy, so without this the next sync pulls it back.
    await recordBillDeletion(billId);
    await CompressedStorage.setItem(BILLS_KEY, updated);

    // Tell the cloud when it is reachable, but do not hold the user on a
    // network round trip to watch the bill disappear: the tombstone above is
    // what makes the deletion stick, and it is replayed on the next sync.
    void deleteBillInCloud(billId);

    triggerBackgroundCloudSync();
  } catch (error) {
    console.error('Error deleting bill:', error);
    throw error;
  }
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  try {
    const profile = await CompressedStorage.getItem<BusinessProfile>(PROFILE_KEY);
    if (!profile) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...profile };
  } catch (error) {
    console.error('Error fetching profile:', error);
    return DEFAULT_PROFILE;
  }
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  try {
    await CompressedStorage.setItem(PROFILE_KEY, profile);
    triggerBackgroundCloudSync();
  } catch (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
}

export interface ContractorPreset {
  id: 'ramesh' | 'rajeeb' | string;
  name: string;
  title: string;
  phone: string;
  address: string;
}

const CONTRACTOR_PRESETS_KEY = '@billmaker_contractor_presets';

export const DEFAULT_CONTRACTOR_PRESETS: ContractorPreset[] = [
  {
    id: 'ramesh',
    name: 'RAMESH RAUT',
    title: 'PLUMBING & CIVIL WORKS CONTRACTOR',
    phone: '+91 9860980626',
    address: 'Sus, Pune - 411021',
  },
  {
    id: 'rajeeb',
    name: 'RAJEEB RAUT',
    title: 'PLUMBING & CIVIL WORKS CONTRACTOR',
    phone: '+91 9860980626',
    address: 'Sus, Pune - 411021',
  },
];

export async function getContractorPresets(): Promise<ContractorPreset[]> {
  try {
    const list = await CompressedStorage.getItem<ContractorPreset[]>(CONTRACTOR_PRESETS_KEY);
    if (!list || !Array.isArray(list)) return DEFAULT_CONTRACTOR_PRESETS;
    const hasRamesh = list.some((p) => p.id === 'ramesh');
    const hasRajeeb = list.some((p) => p.id === 'rajeeb');
    const combined = [...list];
    if (!hasRamesh) combined.unshift(DEFAULT_CONTRACTOR_PRESETS[0]);
    if (!hasRajeeb) combined.push(DEFAULT_CONTRACTOR_PRESETS[1]);
    return combined;
  } catch (error) {
    console.error('Error fetching contractor presets:', error);
    return DEFAULT_CONTRACTOR_PRESETS;
  }
}

export async function saveContractorPreset(preset: ContractorPreset): Promise<void> {
  try {
    const presets = await getContractorPresets();
    const idx = presets.findIndex((p) => p.id === preset.id);
    if (idx >= 0) {
      presets[idx] = preset;
    } else {
      presets.push(preset);
    }
    await CompressedStorage.setItem(CONTRACTOR_PRESETS_KEY, presets);
  } catch (error) {
    console.error('Error saving contractor preset:', error);
    throw error;
  }
}
