import React from 'react';

import { EmptyState } from './EmptyState.jsx';

function getCellValue(row, column) {
  if (typeof column.render === 'function') {
    return column.render(row);
  }

  const value = row?.[column.key];

  if (value === null || value === undefined || value === '') {
    return '—';
  }

  return value;
}

function getRowKey(row, index, rowKey) {
  if (typeof rowKey === 'function') {
    return rowKey(row, index);
  }

  if (typeof rowKey === 'string' && row?.[rowKey]) {
    return row[rowKey];
  }

  return row?.id || row?.uuid || row?.key || `${index}-${JSON.stringify(row).slice(0, 40)}`;
}

function getEmptyCopy(empty) {
  if (React.isValidElement(empty)) return { node: empty };

  if (empty && typeof empty === 'object') {
    return {
      title: empty.title || 'No records yet',
      description: empty.description || 'Records will appear here when they are added to this workspace.',
      eyebrow: empty.eyebrow || 'Empty state',
    };
  }

  const text = String(empty || 'No records found.').trim();

  return {
    title: text.replace(/[.]+$/, '') || 'No records yet',
    description: 'Records will appear here when they are added to this workspace.',
    eyebrow: 'Empty state',
  };
}

function EmptyTableState({ empty }) {
  const copy = getEmptyCopy(empty);

  if (copy.node) return copy.node;

  return (
    <div className="table-empty-state">
      <EmptyState
        compact
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />
    </div>
  );
}

export function DataTable({
  columns = [],
  rows = [],
  empty = 'No records found.',
  rowKey = 'id',
  compact = false,
}) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  if (!safeColumns.length) {
    return (
      <div className="table-wrap">
        <EmptyTableState empty="No table columns configured." />
      </div>
    );
  }

  if (!safeRows.length) {
    return (
      <div className={`table-wrap empty-table-wrap ${compact ? 'compact-table-wrap' : ''}`}>
        <EmptyTableState empty={empty} />
      </div>
    );
  }

  return (
    <div className={`table-wrap ${compact ? 'compact-table-wrap' : ''}`}>
      <table className={`data-table ${compact ? 'compact-table' : ''}`}>
        <thead>
          <tr>
            {safeColumns.map((column) => (
              <th key={column.key || column.label}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {safeRows.map((row, rowIndex) => (
            <tr key={getRowKey(row, rowIndex, rowKey)}>
              {safeColumns.map((column) => (
                <td key={column.key || column.label}>{getCellValue(row, column)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
