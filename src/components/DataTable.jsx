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
      eyebrow: empty.eyebrow || 'No data yet',
    };
  }

  const text = String(empty || 'No records found.').trim();

  return {
    title: text.replace(/[.]+$/, '') || 'No records yet',
    description: 'Records will appear here when they are added to this workspace.',
    eyebrow: 'No data yet',
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

function getTableLabel(label, safeColumns, safeRows) {
  if (label) return label;

  const columnCount = safeColumns.length;
  const rowCount = safeRows.length;

  if (!rowCount) return `Empty table with ${columnCount} columns`;

  return `Data table with ${rowCount} ${rowCount === 1 ? 'row' : 'rows'} and ${columnCount} ${columnCount === 1 ? 'column' : 'columns'}`;
}

export function DataTable({
  columns = [],
  rows = [],
  empty = 'No records found.',
  rowKey = 'id',
  compact = false,
  label = '',
}) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const tableLabel = getTableLabel(label, safeColumns, safeRows);

  if (!safeColumns.length) {
    return (
      <div className="table-wrap empty-table-wrap" role="region" aria-label="Table unavailable">
        <EmptyTableState empty={{ title: 'Table unavailable', description: 'This view needs a quick setup review before records can be shown.', eyebrow: 'Needs review' }} />
      </div>
    );
  }

  if (!safeRows.length) {
    return (
      <div
        className={`table-wrap empty-table-wrap ${compact ? 'compact-table-wrap' : ''}`}
        role="region"
        aria-label={tableLabel}
      >
        <EmptyTableState empty={empty} />
      </div>
    );
  }

  return (
    <div
      className={`table-wrap ${compact ? 'compact-table-wrap' : ''}`}
      role="region"
      aria-label={tableLabel}
      tabIndex={0}
    >
      <table className={`data-table ${compact ? 'compact-table' : ''}`}>
        <thead>
          <tr>
            {safeColumns.map((column) => (
              <th key={column.key || column.label} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {safeRows.map((row, rowIndex) => (
            <tr key={getRowKey(row, rowIndex, rowKey)}>
              {safeColumns.map((column) => (
                <td key={column.key || column.label} data-label={column.label || column.key}>
                  {getCellValue(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
