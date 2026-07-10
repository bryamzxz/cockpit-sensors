# Changelog

## 1.5.0 (unreleased)

### Fixed
- hwmon now polls sysfs at the configured refresh interval. The previous
  `cockpit.file().watch()` approach never fired (sysfs attributes emit no
  inotify events), so the dashboard showed frozen values forever; teardown
  also leaked one superuser channel per sensor.
- `tsc --noEmit` errors repaired and type checking enforced in CI.
- The RPM spec no longer references the removed `index.css.LEGAL.txt`; the
  Debian control gets its version injected by `make deb` instead of a stale
  hardcoded one.
- The integration test targets the PatternFly 6 layout again.
- Translations load before the bundle, so module-level strings actually
  translate; concatenated fragments replaced by whole-sentence
  `cockpit.format` templates.

### Performance
- All providers share a pause-aware polling loop with an overlap guard;
  pausing (or hiding the tab) no longer restarts the provider stack, and
  auto-pause now auto-resumes when the page becomes visible.
- Disk providers cache the device scan (re-scan every 60s), query devices in
  parallel, poll at a 10s floor and pass `smartctl -n standby` so sleeping
  disks stay asleep.
- The 1-second "updated" ticker renders in an isolated component; tabs mount
  on demand; sensor history moved to a shared store recorded once per refresh
  (fixes duplicated samples that shrank the sparkline window and skewed
  session stats); rows and formatters are memoized.

### Design
- The sensor table is a responsive PatternFly `Table` (stacked layout on
  narrow screens); density maps to the PF compact variant.
- Dark theme follows the Cockpit shell (`shell:style` + `cockpit-style`
  events) instead of observing the parent frame; the `color-scheme` override
  that broke forced-light mode is gone.
- Accessibility: no badge inside the page `h1`, no redundant ARIA roles, the
  shortcuts legend is visible to assistive tech, disabled Export shows its
  explanatory tooltip, and empty states use the right icons plus a working
  "Clear filter" action.
- Sparklines enforce a minimum vertical span (idle jitter reads flat) and
  show the hovered value inline; animations honour
  `prefers-reduced-motion`.
- The no-backends banner offers dnf and apt commands; the module declares
  manifest keywords for shell search.

### Tooling
- CI runs stylelint and the coverage gates alongside lint, typecheck, tests
  and build; `make` uses `npm ci` for reproducible installs.
- Packaging metadata points at this fork; packit drops EOL targets and
  dist-git jobs; test images bumped to fedora-43/centos-9-stream.
- Dev dependencies upgraded (esbuild 0.28, stylelint 17, testing-library 16,
  jsdom 27, gettext-parser 9, react-hooks plugin 7, PatternFly 6.6).

## Older unreleased work

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
