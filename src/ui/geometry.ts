const MIN_COLUMNS = 40;
const MIN_ROWS = 12;

export type TerminalLayout = ReturnType<typeof getTerminalLayout>;

export function getTerminalLayout(columns = 80, rows = 24, paneCount = 1) {
  const safeColumns = Math.max(MIN_COLUMNS, Math.floor(columns));
  const safeRows = Math.max(MIN_ROWS, Math.floor(rows));
  const safePaneCount = Math.max(1, Math.floor(paneCount));
  const compact = safeRows < 30;

  return {
    compact,
    narrow: safeColumns < 100,
    wide: safeColumns >= 160,
    footerCompact: compact || safeColumns < 100,
    paneWidth: Math.max(20, Math.floor(safeColumns / safePaneCount) - 2),
    serviceRows: Math.max(1, Math.min(12, safeRows - (compact ? 18 : 24))),
  };
}

export type ServiceColumns = { name: number; status: number; image: number; ports: number };

export function getServiceColumns(containerWidth = 80): ServiceColumns {
  const total = Math.max(30, Math.floor(containerWidth) - 6);
  if (total < 50) return { name: total - 12, status: 12, image: 0, ports: 0 };
  if (total < 80) {
    const ports = Math.floor(total * 0.3);
    return { name: total - 12 - ports, status: 12, image: 0, ports };
  }
  const name = Math.floor(total * 0.28);
  const status = Math.floor(total * 0.12);
  const image = Math.floor(total * 0.35);
  return { name, status, image, ports: total - name - status - image };
}
