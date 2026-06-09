export function formatAmount(amount: number, signed = false, type?: 'expense' | 'income'): string {
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  if (!signed) {
    return `$${formatted}`;
  }

  if (type === 'income') {
    return `+$${formatted}`;
  }

  if (type === 'expense') {
    return `−$${formatted}`;
  }

  const prefix = amount < 0 ? '−' : amount > 0 ? '+' : '';
  return `${prefix}$${formatted}`;
}

export function parseAmountInput(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}
