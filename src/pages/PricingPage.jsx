/* Landing page polish */

.landing-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(27, 153, 139, 0.14), transparent 34%),
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 28%),
    linear-gradient(180deg, #f7f8fa 0%, #ffffff 100%);
}

.landing-nav {
  width: min(1180px, calc(100% - 36px));
  margin: 0 auto;
  padding: 18px 0;
}

.landing-hero {
  width: min(1180px, calc(100% - 36px));
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.62fr);
  gap: 34px;
  align-items: center;
  padding: 64px 0 42px;
}

.landing-hero h1 {
  margin-bottom: 16px;
  color: var(--text);
  font-size: clamp(44px, 6.5vw, 78px);
  line-height: 0.95;
  letter-spacing: -0.075em;
}

.landing-hero p {
  max-width: 720px;
  font-size: 17px;
}

.landing-trust-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.landing-trust-row span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  color: var(--text);
  font-size: 12px;
  font-weight: 800;
  box-shadow: var(--shadow-sm);
}

.landing-trust-row svg {
  color: var(--accent);
}

.landing-dashboard-preview {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-lg);
}

.landing-preview-header,
.landing-preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.landing-preview-header span:first-child {
  display: grid;
  gap: 3px;
}

.landing-preview-header strong,
.landing-preview-footer span {
  color: var(--text);
}

.landing-preview-header small {
  color: var(--muted);
  font-weight: 700;
}

.landing-live-pill {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
}

.landing-preview-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.landing-preview-kpis span {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-2);
}

.landing-preview-kpis small {
  color: var(--muted);
  font-weight: 800;
}

.landing-preview-kpis strong {
  color: var(--text);
  font-size: 24px;
  letter-spacing: -0.06em;
}

.landing-preview-list {
  display: grid;
  gap: 10px;
}

.landing-preview-list div {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.landing-preview-list svg {
  color: var(--accent);
}

.landing-preview-list span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.landing-preview-list strong {
  color: var(--text);
}

.landing-preview-list small {
  color: var(--muted);
  font-weight: 700;
}

.landing-preview-footer {
  padding-top: 2px;
}

.landing-content {
  width: min(1180px, calc(100% - 36px));
  margin: 0 auto;
  display: grid;
  gap: 18px;
  padding: 24px 0 72px;
}

.landing-section-card {
  display: grid;
  gap: 18px;
}

.landing-feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.landing-feature-card {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 14px;
  align-items: flex-start;
}

.landing-feature-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: var(--accent-soft);
  color: var(--accent);
}

.landing-feature-card h3 {
  margin-bottom: 5px;
}

.landing-feature-card p {
  margin-bottom: 0;
}

.landing-split-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  align-items: stretch;
}

.landing-checklist-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.landing-mini-metrics {
  display: grid;
  gap: 10px;
}

.landing-mini-metrics span {
  display: grid;
  gap: 3px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface-2);
}

.landing-mini-metrics strong {
  color: var(--text);
}

.landing-mini-metrics small {
  color: var(--muted);
  font-weight: 700;
}

.landing-final-cta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
}

.landing-final-cta h3 {
  margin-bottom: 6px;
  color: var(--text);
  font-size: clamp(28px, 4vw, 44px);
  letter-spacing: -0.06em;
}

.landing-final-cta p:last-child {
  margin-bottom: 0;
}

.landing-final-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 1100px) {
  .landing-hero,
  .landing-feature-grid,
  .landing-split-grid,
  .landing-final-cta {
    grid-template-columns: 1fr;
  }

  .landing-dashboard-preview {
    max-width: 720px;
  }

  .landing-final-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 760px) {
  .landing-nav,
  .landing-hero,
  .landing-content {
    width: min(100% - 24px, 1180px);
  }

  .landing-hero {
    padding-top: 38px;
  }

  .landing-preview-kpis,
  .landing-checklist-grid {
    grid-template-columns: 1fr;
  }

  .landing-feature-card {
    grid-template-columns: 1fr;
  }

  .landing-preview-header,
  .landing-preview-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .landing-final-actions,
  .landing-final-actions button {
    width: 100%;
  }
}
