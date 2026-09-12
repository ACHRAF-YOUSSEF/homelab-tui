const MIN_COLUMNS = 40;
const MIN_ROWS = 12;

export type TerminalLayout = ReturnType<typeof getTerminalLayout>;

export function getFooterRows(columns = 80, paneCount = 1) {
  const innerWidth = Math.max(1, Math.max(MIN_COLUMNS, Math.floor(columns)) - 4);
  const hintWidth = Math.max(1, Math.floor(paneCount)) > 1 ? 139 : 112;
  return Math.ceil(hintWidth / innerWidth) + 2;
}

export function getTerminalLayout(columns = 80, rows = 24, paneCount = 1, logsOpen = false) {
  const safeColumns = Math.max(MIN_COLUMNS, Math.floor(columns));
  const safeRows = Math.max(MIN_ROWS, Math.floor(rows));
  const safePaneCount = Math.max(1, Math.floor(paneCount));
  const compact = safeRows < 30;
  const footerExtraRows = getFooterRows(safeColumns, safePaneCount) - 3;
  const sharedRows = Math.max(2, safeRows - 19 - footerExtraRows);
  const serviceRows = logsOpen
    ? Math.max(1, Math.min(8, Math.floor(sharedRows * 0.4)))
    : Math.max(1, Math.min(12, safeRows - (compact ? 18 : 24) - footerExtraRows));

  return {
    compact,
    narrow: safeColumns < 100,
    wide: safeColumns >= 160,
    paneWidth: Math.max(20, safeColumns - 2),
    serviceRows,
    logRows: logsOpen ? Math.max(1, Math.min(15, sharedRows - serviceRows)) : 0,
  };
}

export function getVisibleTabIndexes(columns = 80, paneCount = 1, focusedPane = 0) {
  const count = Math.max(1, Math.floor(paneCount));
  const focus = Math.min(Math.max(0, Math.floor(focusedPane)), count - 1);
  const visibleCount = Math.min(count, Math.max(1, Math.floor((Math.max(MIN_COLUMNS, columns) - 42) / 18)));
  const start = Math.min(Math.max(0, focus - Math.floor(visibleCount / 2)), count - visibleCount);
  return Array.from({ length: visibleCount }, (_, index) => start + index);
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
