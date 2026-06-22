var fs=require('fs');
var s=`:root {
  --bg: #f0f2f5;
  --surface: #ffffff;
  --border: #dde1e7;
  --border-strong: #b0b8c4;
  --text: #1a2233;
  --text-secondary: #5a6478;
  --text-tertiary: #9aa0ad;
  --accent: #1b3a6b;
  --accent-hover: #142d54;
  --accent-bg: #e8eef8;
  --success: #1a6b3a;
  --success-bg: #e8f5ee;
  --danger: #a32d2d;
  --radius-md: 6px;
  --radius-lg: 10px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

#app {
  max-width: 820px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  background: var(--accent);
  color: #fff;
  padding: 14px 24px;
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 16px rgba(27,58,107,0.15);
}

.header h1 {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 2px;
  color: #fff;
  letter-spacing: 0.03em;
}

.subtitle {
  color: rgba(255,255,255,0.7);
  margin: 0;
  font-size: 13px;
}

.user-badge {
  text-align: right;
  font-size: 13px;
  color: rgba(255,255,255,0.85);
}

.user-badge .name {
  font-weight: 700;
  color: #fff;
}

.user-badge .role {
  color: rgba(255,255,255,0.65);
  font-size: 12px;
}

.section-title {
  font-weight: 700;
  margin: 0 0 10px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--accent);
}

.block {
  margin-bottom: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.hint {
  color: var(--text-secondary);
  margin: 0 0 10px;
  font-size: 13px;
}

textarea, input[type="text"], input[type="password"], select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

textarea:focus, input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(27,58,107,0.1);
}

textarea {
  resize: vertical;
  font-family: inherit;
  font-size: 13px;
}

button {
  padding: 8px 16px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

button:hover {
  background: var(--bg);
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}

button:active { transform: scale(0.98); }

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

button.primary:hover {
  background: var(--accent-hover);
  box-shadow: 0 4px 12px rgba(27,58,107,0.25);
}

button.danger {
  color: var(--danger);
  border-color: var(--danger);
}

.row {
  display: flex;
  gap: 8px;
}

.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.chip {
  background: var(--accent-bg);
  border: 1px solid #c5d3eb;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  font-weight: 500;
}

.chip button {
  padding: 0 4px;
  border: none;
  background: none;
  font-size: 14px;
  color: var(--danger);
  line-height: 1;
}

.card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  margin-bottom: 10px;
  background: var(--surface);
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  transition: box-shadow 0.15s;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.card-title {
  font-weight: 700;
  margin: 0;
  font-size: 14px;
  color: var(--accent);
}

.card-meta {
  color: var(--text-secondary);
  margin: 4px 0 0;
  font-size: 13px;
}

.assign-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.assign-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  background: var(--bg);
  padding: 4px 10px;
  border-radius: 20px;
  cursor: pointer;
  border: 1px solid var(--border);
  transition: background 0.15s, border-color 0.15s;
}

.assign-label.checked {
  background: var(--accent-bg);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.assign-label input {
  margin: 0;
  width: auto;
}

.history-block {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  font-size: 13px;
}

.history-block p { margin: 0 0 4px; }

.label-muted { color: var(--text-secondary); }

.status-achete { color: var(--success); font-weight: 600; }
.status-non-achete { color: var(--text-tertiary); }

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-group { margin-bottom: 10px; }

.checkbox-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  margin-bottom: 8px;
  cursor: pointer;
}

.checkbox-line input { margin: 0; width: auto; }

.empty { color: var(--text-tertiary); font-style: italic; }

/* Login */
.login-wrap {
  max-width: 380px;
  margin: 5rem auto;
  padding: 2rem;
  border: none;
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: 0 8px 32px rgba(27,58,107,0.12);
}

.login-wrap h1 {
  font-size: 26px;
  margin: 0 0 4px;
  color: var(--accent);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.login-wrap .subtitle {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 1.5rem;
}

.error-msg {
  color: var(--danger);
  font-size: 13px;
  margin: 8px 0 0;
}

/* PDF list */
.pdf-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  gap: 8px;
}

.pdf-list-item:last-child { border-bottom: none; }

/* PDF Page Selector Modal */
.pdf-page-thumb {
  cursor: pointer;
  border: 2.5px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  background: var(--bg);
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  user-select: none;
}

.pdf-page-thumb:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.pdf-page-thumb.selected {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 3px var(--accent-bg) !important;
}

.page-checkmark {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: none;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}

.page-checkmark.visible { display: flex; }

/* Fiche */
.fiche-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.fiche-section:last-of-type { border-bottom: none; }

.fiche-title {
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
  margin: 0 0 10px;
}

.fiche-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 600px;
}
.fiche-table th {
  background: var(--accent);
  border: 1px solid var(--accent);
  padding: 7px 8px;
  text-align: left;
  font-weight: 600;
  font-size: 11px;
  color: #fff;
  white-space: nowrap;
}
.fiche-table td {
  border: 1px solid var(--border);
  padding: 4px 6px;
  vertical-align: middle;
}
.fiche-table .fiche-auto {
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}
.fiche-input {
  width: 80px !important;
  padding: 4px 6px !important;
  font-size: 12px !important;
  border: 1px solid var(--border-strong) !important;
  border-radius: 4px !important;
}

.patron-retour-block {
  background: var(--bg);
  border-radius: var(--radius-md);
  padding: 12px;
  margin-top: 10px;
  border-left: 3px solid var(--accent);
}
`;
require('fs').writeFileSync('public/style.css', s);
console.log('ok');
