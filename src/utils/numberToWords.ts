const ONES = [
  '',
  'ONE',
  'TWO',
  'THREE',
  'FOUR',
  'FIVE',
  'SIX',
  'SEVEN',
  'EIGHT',
  'NINE',
  'TEN',
  'ELEVEN',
  'TWELVE',
  'THIRTEEN',
  'FOURTEEN',
  'FIFTEEN',
  'SIXTEEN',
  'SEVENTEEN',
  'EIGHTEEN',
  'NINETEEN',
];

const TENS = [
  '',
  '',
  'TWENTY',
  'THIRTY',
  'FORTY',
  'FIFTY',
  'SIXTY',
  'SEVENTY',
  'EIGHTY',
  'NINETY',
];

function convertLessThanThousand(num: number): string {
  let str = '';
  if (num >= 100) {
    str += ONES[Math.floor(num / 100)] + ' HUNDRED ';
    num %= 100;
  }
  if (num >= 20) {
    str += TENS[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ONES[num % 10] : '');
  } else if (num > 0) {
    str += ONES[num];
  }
  return str.trim();
}

/**
 * Converts numbers into Indian numbering system words:
 * Crores, Lakhs, Thousands, Hundreds
 * Example: 18500 -> "EIGHTEEN THOUSAND FIVE HUNDRED ONLY"
 */
export function numberToWordsIndian(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'ZERO RUPEES ONLY';
  }

  const integerPart = Math.floor(Math.abs(amount));
  if (integerPart === 0) {
    return 'ZERO RUPEES ONLY';
  }

  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const remainder = integerPart % 1000;

  const parts: string[] = [];

  if (crore > 0) {
    parts.push(convertLessThanThousand(crore) + ' CRORE');
  }
  if (lakh > 0) {
    parts.push(convertLessThanThousand(lakh) + ' LAKH');
  }
  if (thousand > 0) {
    parts.push(convertLessThanThousand(thousand) + ' THOUSAND');
  }
  if (remainder > 0) {
    parts.push(convertLessThanThousand(remainder));
  }

  return (parts.join(' ') + ' ONLY').trim();
}
