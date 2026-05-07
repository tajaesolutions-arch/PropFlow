import React from 'react';

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
        <div className="empty-cell">{empty}</div>
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
          {safeRows.length ? (
            safeRows.map((row, rowIndex) => (
              <tr key={getRowKey(row, rowIndex, rowKey)}>
                {safeColumns.map((column) => (
                  <td key={column.key || column.label}>{getCellValue(row, column)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={safeColumns.length} className="empty-cell">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
