/* Global search suggestions */

.global-search {
  position: relative;
  min-width: min(420px, 100%);
}

.search-box {
  position: relative;
}

.search-clear {
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
}

.search-clear:hover {
  background: #f1f5f9;
}

.global-search-results {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  z-index: 35;
  width: min(520px, 90vw);
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16);
}

.global-search-results button {
  width: 100%;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  border: 0;
  background: transparent;
  border-radius: 12px;
  padding: 10px;
  text-align: left;
}

.global-search-results button:hover {
  background: #f8fafc;
}

.global-search-results span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.global-search-results strong,
.global-search-results small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-search-results em {
  flex: 0 0 auto;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  padding: 4px 8px;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}

.global-search-empty {
  padding: 12px;
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 760px) {
  .global-search {
    width: 100%;
  }

  .global-search-results {
    position: fixed;
    top: 120px;
    left: 16px;
    right: 16px;
    width: auto;
  }
}
