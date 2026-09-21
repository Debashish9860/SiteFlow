import { PresetCatalogItem } from '../types/bill';

export const PRESET_CATALOG: PresetCatalogItem[] = [
  // --- Pipes (Measured in Running Feet / Rft, Meters / Mtr, Feet / ft) ---
  { name: '1" CPVC Pipe', subDescription: 'Material supply (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 70 },
  { name: '3/4" CPVC Pipe', subDescription: 'Material supply (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 45 },
  { name: '1/2" CPVC Pipe', subDescription: 'Material supply (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 35 },
  { name: '1.25" CPVC Pipe', subDescription: 'Material supply (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 95 },
  { name: '1.5" CPVC Pipe', subDescription: 'Material supply (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 125 },
  { name: '2" CPVC Pipe', subDescription: 'Material supply (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 180 },
  { name: '4" PVC Drainage Pipe', subDescription: 'Drainage line (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 85 },
  { name: '3" PVC Drainage Pipe', subDescription: 'Drainage line (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 70 },
  { name: '2.5" PVC Waste Pipe', subDescription: 'Drainage line (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 55 },
  { name: '6" Underground Drainage Pipe', subDescription: 'Main sewer line (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 190 },
  { name: '1" UPVC Cold Water Pipe', subDescription: 'Material supply (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 55 },
  { name: '3/4" UPVC Cold Water Pipe', subDescription: 'Material supply (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 40 },
  { name: 'PPR / HDPE Water Supply Pipe', subDescription: 'Material supply (per Meter)', category: 'plumbing', defaultUnit: 'Mtr', suggestedRate: 90 },
  { name: '1" GI Heavy Pipe', subDescription: 'Material supply (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 160 },
  { name: '3/4" GI Heavy Pipe', subDescription: 'Material supply (per Rft)', category: 'plumbing', defaultUnit: 'Rft', suggestedRate: 120 },
  { name: 'Flexible Connection Pipe', subDescription: 'Sanitary connection', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 150 },

  // --- Piping & Fitting Labour (Per Rft / Mtr / Point) ---
  { name: 'Concealed Pipe Line Chasing & Laying', subDescription: 'Labour charges (per Rft)', category: 'labor', defaultUnit: 'Rft', suggestedRate: 45 },
  { name: 'Open Pipe Line Fitting Labour', subDescription: 'Labour charges (per Rft)', category: 'labor', defaultUnit: 'Rft', suggestedRate: 30 },
  { name: 'Drainage & Rainwater Pipe Fixing', subDescription: 'Labour charges (per Rft)', category: 'labor', defaultUnit: 'Rft', suggestedRate: 40 },
  { name: 'Underground Trenching & Piping Work', subDescription: 'Labour charges (per Meter)', category: 'labor', defaultUnit: 'Mtr', suggestedRate: 150 },

  // --- Common Fittings & Hardware (Measured in pcs / nos) ---
  { name: '1" Elbow', subDescription: 'Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 100 },
  { name: '3/4" Elbow', subDescription: 'Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 45 },
  { name: '1/2" Elbow', subDescription: 'Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 30 },
  { name: '1" Tee', subDescription: 'Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 120 },
  { name: '3/4" Tee', subDescription: 'Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 60 },
  { name: '1/2" Tee', subDescription: 'Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 40 },
  { name: '1" Brass MTA / FTA', subDescription: 'Brass Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 140 },
  { name: '3/4" Brass MTA / FTA', subDescription: 'Brass Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 110 },
  { name: '1" Brass Elbow / Tee', subDescription: 'Brass Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 160 },
  { name: '3/4" Brass Elbow / Tee', subDescription: 'Brass Fittings', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 130 },
  { name: 'Concealed Stop Cock', subDescription: 'Fitting', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 450 },
  { name: 'Angle Valve', subDescription: 'Sanitary fitting', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 280 },
  { name: 'Bib Cock Tap', subDescription: 'Hardware', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 350 },
  { name: '1" Brass Ball Valve', subDescription: 'Valve fitting', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 380 },
  { name: 'Nahani Trap / Floor Trap', subDescription: 'Drainage fitting', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 180 },
  { name: 'Overhead Water Tank 1000L', subDescription: 'Tank Supply', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 4500 },
  { name: 'Overhead Water Tank 500L', subDescription: 'Tank Supply', category: 'plumbing', defaultUnit: 'pcs', suggestedRate: 2800 },

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
  { name: 'Core Cutting (Pipe Hole)', subDescription: 'Depth drilling (per inch)', category: 'labor', defaultUnit: 'inch', suggestedRate: 70 },
  { name: 'Wall Chasing & Groove Cutting', subDescription: 'Labour charges (per foot)', category: 'labor', defaultUnit: 'ft', suggestedRate: 25 },
  { name: 'Wall Plaster Work', subDescription: 'Civil work', category: 'civil', defaultUnit: 'sq.ft', suggestedRate: 22 },
  { name: 'Tile Fixing Work', subDescription: 'Civil work', category: 'civil', defaultUnit: 'sq.ft', suggestedRate: 25 },
];

export const STANDARD_UNITS = [
  'Rft',
  'ft',
  'inch',
  'Mtr',
  'pcs',
  'nos',
  'lump-sum',
  'days',
  'pts',
  'sq.ft',
  'sq.m',
  'bags',
  'kg',
  'ltr',
  'brass',
];

export const UNIT_DISPLAY_LABELS: Record<string, string> = {
  Rft: 'Rft (Running Ft)',
  ft: 'ft (Feet)',
  inch: 'inch (Inches)',
  Mtr: 'Mtr (Meters)',
  pcs: 'pcs (Pieces)',
  nos: 'nos (Numbers)',
  'lump-sum': 'lump-sum',
  days: 'days (Days)',
  pts: 'pts (Points)',
  'sq.ft': 'sq.ft (Sq Feet)',
  'sq.m': 'sq.m (Sq Meters)',
  bags: 'bags',
  kg: 'kg',
  ltr: 'ltr',
  brass: 'brass',
};

export const COMMON_SUB_DESCRIPTIONS = [
  'Labour charges',
  'Material supply',
  'Fitting charges',
  'Installation charges',
  'Labour & Material',
  'Chasing & Laying',
];
