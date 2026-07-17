import { UnknownTaxYearError } from '../../core/errors';
import type { IlYearData } from '../../core/types';
import { il2024 } from './years/2024';
import { il2025 } from './years/2025';
import { il2026 } from './years/2026';

const YEAR_DATA: ReadonlyMap<number, IlYearData> = new Map(
  [il2024, il2025, il2026].map((data) => [data.year, data]),
);

export const SUPPORTED_IL_YEARS: readonly number[] = [...YEAR_DATA.keys()].sort();

export function getIlYearData(year: number): IlYearData {
  const data = YEAR_DATA.get(year);
  if (!data) throw new UnknownTaxYearError(year);
  return data;
}
