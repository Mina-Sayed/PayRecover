import { Prisma } from '@prisma/client';

const DECIMAL_SCALE = 2;

export function toDecimal(value: number | string | Prisma.Decimal): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  return new Prisma.Decimal(value).toDecimalPlaces(DECIMAL_SCALE);
}

export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  return value.toNumber();
}

export function amountToMinorUnits(value: Prisma.Decimal | number | string): number {
  return Math.round(decimalToNumber(value) * 100);
}

export function formatCurrencyAmount(value: Prisma.Decimal | number | string): string {
  return decimalToNumber(value).toFixed(DECIMAL_SCALE);
}
