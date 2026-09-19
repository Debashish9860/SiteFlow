import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bill, BusinessProfile } from '../types/bill';

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
    const data = await AsyncStorage.getItem(BILLS_KEY);
    if (!data) return [];
    const bills: Bill[] = JSON.parse(data);
    // ensure billType and billedBy exist for older records
    return bills
      .map((b) => ({
        ...b,
        billType: b.billType || 'invoice',
        billedBy: b.billedBy || 'Ramesh Raut',
        billedByTitle: b.billedByTitle || 'PLUMBING & CIVIL WORKS CONTRACTOR',
        billedByPhone: b.billedByPhone || '+91 9860980626',
        billedByAddress: b.billedByAddress || 'Sus, Pune - 411021',
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
    const existingIndex = bills.findIndex((b) => b.id === newBill.id);
    if (existingIndex >= 0) {
      bills[existingIndex] = newBill;
    } else {
      bills.unshift(newBill);
    }
    await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(bills));
  } catch (error) {
    console.error('Error saving bill:', error);
    throw error;
  }
}

export async function deleteBill(billId: string): Promise<void> {
  try {
    const bills = await getBills();
    const updated = bills.filter((b) => b.id !== billId);
    await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error deleting bill:', error);
    throw error;
  }
}

export async function getBusinessProfile(): Promise<BusinessProfile> {
  try {
    const data = await AsyncStorage.getItem(PROFILE_KEY);
    if (!data) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(data) };
  } catch (error) {
    console.error('Error fetching profile:', error);
    return DEFAULT_PROFILE;
  }
}

export async function saveBusinessProfile(profile: BusinessProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
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
    const data = await AsyncStorage.getItem(CONTRACTOR_PRESETS_KEY);
    if (!data) return DEFAULT_CONTRACTOR_PRESETS;
    const list: ContractorPreset[] = JSON.parse(data);
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
    await AsyncStorage.setItem(CONTRACTOR_PRESETS_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Error saving contractor preset:', error);
    throw error;
  }
}
