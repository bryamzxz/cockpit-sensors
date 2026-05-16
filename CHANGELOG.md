# Changelog

## Unreleased

- Target Cockpit 361 (manifest requires `cockpit >= 361`) and migrate the UI to
  PatternFly 6: drop `pf-c-*`/`pf-v5-*` legacy selectors, replace
  `PageSection variant="light"`, deprecated `EmptyStateHeader` and the legacy
  Modal layout with the PF6 equivalents (`ModalHeader`/`Body`/`Footer`,
  `EmptyState titleText`, PF6 design tokens).
- Redesign the dashboard with a hero header (title, status pill, last-update
  indicator, data-source labels), per-category tab badges that surface
  count/threshold state, and a KPI summary row with total readings,
  hottest/peak value and live average.
- Add a card view alongside the table view, a search filter, density toggle,
  pause/resume control (with auto-pause when the tab is hidden) and keyboard
  shortcuts (`/`, `P`, `U`, `V`).
- Upgrade the sparkline with gradient area, threshold guide, hover cursor and
  status-aware colouring; introduce a progress bar that shows the current value
  against the sensor's high threshold.
- Render PatternFly toggle groups for refresh interval, temperature unit,
  density and view mode for fast, accessible switching.
- Surface a session-aware status pill ("All sensors healthy", "Approaching
  threshold", "Threshold exceeded", "Paused", privilege/error states).
- Expand the Sensors table to full width within Cockpit.
- Persist sensor history in memory to expose per-session min/avg/max stats.
- Add sparkline trend visualisations and threshold-based highlighting.
- Provide toolbar controls for refresh interval, °C/°F toggle and CSV export.
- Allow pinning favourite sensors and surface clear zero states per category.
- Persist refresh, unit and pinned preferences via localStorage.
- Document the new session analytics workflow and add coverage for helpers.
