import { PresetCatalogItem } from '../types/bill';

export const PRESET_CATALOG: PresetCatalogItem[] = [
  // --- Common Particulars (With typical rate & unit) ---
  { name: '1" Elbow', subDescription: 'Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 100 },
  { name: '3/4" Elbow', subDescription: 'Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 45 },
  { name: '1" Tee', subDescription: 'Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 120 },
  { name: '3/4" Tee', subDescription: 'Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 60 },
  { name: '1" CPVC Pipe', subDescription: 'Material supply', category: 'plumbing', defaultUnit: 'ft', suggestedRate: 70 },
  { name: '3/4" CPVC Pipe', subDescription: 'Material supply', category: 'plumbing', defaultUnit: 'ft', suggestedRate: 45 },
  { name: '1" Brass MTA / FTA', subDescription: 'Brass Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 140 },
  { name: 'Concealed Stop Cock', subDescription: 'Fitting', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 450 },
  { name: 'Angle Valve', subDescription: 'Sanitary fitting', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 280 },
  { name: 'Bib Cock Tap', subDescription: 'Hardware', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 350 },
  { name: '4" PVC Drainage Pipe', subDescription: 'Drainage line', category: 'plumbing', defaultUnit: 'ft', suggestedRate: 85 },
  { name: 'Overhead Water Tank 1000L', subDescription: 'Tank Supply', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 4500 },

  // --- Contractor Works From Sample Bill ---
  {
    name: 'Tank Foundation Making, Solar Tank Inlet & Overflow',
    subDescription: 'Labour charges',
    category: 'civil',
    defaultUnit: 'lump-sum',
    suggestedRate: 5000,
  },
  {
    name: 'Tank Fitting, 1" Pipe Line Fitting',
    subDescription: 'Labour charges',
    category: 'plumbing',
    defaultUnit: 'lump-sum',
    suggestedRate: 10000,
  },
  {
    name: 'Old Tank Remove, Washing Machine Work & Pressure Pump Machine Work',
    subDescription: 'Labour charges',
    category: 'plumbing',
    defaultUnit: 'lump-sum',
    suggestedRate: 3500,
  },
  {
    name: 'Solar Water Heater Piping & Valve Fitting',
    subDescription: 'Labour charges',
    category: 'plumbing',
    defaultUnit: 'lump-sum',
    suggestedRate: 4000,
  },

  // --- Labor & Civil Works ---
  { name: 'Plumber Daily Labor', subDescription: 'Labour charges', category: 'labor', defaultUnit: 'days', suggestedRate: 850 },
  { name: 'Head Mason Labor', subDescription: 'Labour charges', category: 'labor', defaultUnit: 'days', suggestedRate: 950 },
  { name: 'Helper Daily Labor', subDescription: 'Labour charges', category: 'labor', defaultUnit: 'days', suggestedRate: 550 },
  { name: 'Plumbing Point Labor', subDescription: 'Labour charges', category: 'labor', defaultUnit: 'pts', suggestedRate: 450 },
  { name: 'Core Cutting (Pipe Hole)', subDescription: 'Labour charges', category: 'labor', defaultUnit: 'pcs', suggestedRate: 350 },
  { name: 'Wall Plaster Work', subDescription: 'Civil work', category: 'civil', defaultUnit: 'sq.ft', suggestedRate: 22 },
  { name: 'Tile Fixing Work', subDescription: 'Civil work', category: 'civil', defaultUnit: 'sq.ft', suggestedRate: 25 },
];

export const STANDARD_UNITS = [
  'pcs',
  'lump-sum',
  'ft',
  'days',
  'pts',
  'bags',
  'sq.ft',
  'brass',
  'kg',
  'ltr',
];

export const COMMON_SUB_DESCRIPTIONS = [
  'Labour charges',
  'Material supply',
  'Fitting charges',
  'Installation charges',
  'Labour & Material',
];
