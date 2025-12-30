# Cockpit Sensors

Cockpit Sensors is a [Cockpit](https://cockpit-project.org/) module that displays
hardware telemetry collected from the host system. The frontend consumes
standard Linux monitoring interfaces such as `/sys/class/hwmon`,
`sensors -j` (lm-sensors) and `nvme smart-log` (nvme-cli) and surfaces the
available temperature, fan and voltage readings. The project ships a browser
bundle that can be installed on any host running Cockpit and builds through a
custom `build.js` pipeline powered by esbuild, React and PatternFly.

## Requirements

- **Node.js 20.x** (the codebase is tested with Node 20; earlier versions are
  not supported).
- **npm 10** (ships with Node 20) with access to the public npm registry.
- Optional but recommended: `make`, `gettext` and a working Cockpit instance for
  integration tests.

Bootstrap a working copy with the provided script, which clones Cockpit (or
reuses `COCKPIT_DIR`), links the shared `pkg/` directory, installs dependencies
and performs an initial build:

```bash
./scripts/setup.sh
```

> ℹ️ The setup script prefers `npm ci` and falls back to `npm install && npm
> dedupe` when the stricter command is not available.

## Development workflow

The project uses a handcrafted esbuild script (`build.js`) instead of Vite. The
script compiles TypeScript, SCSS and static assets into `dist/`, optionally
rebuilding when files change.

| Task | Command |
| ---- | ------- |
| Rebuild the bundle in watch mode | `npm run dev`
| Build the production bundle | `npm run build`
| Run the Vitest suite with coverage | `npm run test`
| Run ESLint over the repository | `npm run lint`

After pulling updates run the maintenance helper to refresh dependencies only
when `package-lock.json` changed and rebuild the bundle:

```bash
./scripts/maint.sh
```

The script also fetches updates in the neighbouring Cockpit checkout (or the
location provided through `COCKPIT_DIR`) and rewrites the `pkg/` symlink to
point at the latest sources. Continuous integration jobs can run
`./scripts/setup.sh` for a clean install and `./scripts/maint.sh` for
incremental builds without repeating expensive dependency work.

### Building and watching

- `npm run build` executes `node ./build.js` once and writes the optimised
  output to `dist/`.
- `npm run dev` runs the same script with `--watch`. esbuild listens for
  changes in `src/` and `vendor/`, rebuilding the bundle incrementally. This
  command does **not** start a dev server; open the bundle through Cockpit or
  serve `dist/` with a static file server (for example, `npx serve dist` or
  `python -m http.server --directory dist`) if you need to preview the module
  in a browser outside of Cockpit.

### Automatic Cockpit library detection

The build tooling automatically configures the Sass include path, so you no
longer need to export `SASS_PATH` manually. When `npm run build` or
`npm run dev` run, the helper checks the following locations in order and adds
the directories that exist to the Sass loader and `SASS_PATH`:

1. `process.env.COCKPIT_DIR`
2. `../cockpit/pkg/lib` (a sibling checkout of the Cockpit repository)
3. `pkg/lib` (the local Cockpit mirror within this repository)

You can still override the include path by exporting `SASS_PATH` before running
the scripts, in which case the tooling leaves your custom value untouched.

### Data sources and graceful degradation

At runtime the Sensors page evaluates the available telemetry backends in the
following order:

1. `/sys/class/hwmon` for direct kernel sensor exposure.
2. `sensors -j` from the lm-sensors package.
3. `nvme smart-log <device> -o json` from nvme-cli for NVMe device temperatures.

The first backend that reports data for a given sensor kind feeds the UI, while
NVMe telemetry is always added as an extra source when available. If no backend
is present, the page renders a banner with setup instructions and offers a
single-click copy of the recommended installation command:

```bash
sudo apt install lm-sensors nvme-cli smartmontools && sudo sensors-detect --auto
```

Commands are executed via `cockpit.spawn(..., { superuser: 'try' })`. Should the
host require elevated permissions, the page displays a “Retry with privileges”
call to action that re-triggers detection and prompts Cockpit to escalate.

### Session analytics and export

The Sensors table keeps a short rolling history in memory for each detected
sensor (up to 300 samples). The UI exposes per-session minimum/average/maximum
stats, an inline sparkline trend and controls to highlight values approaching or
exceeding the reported thresholds. Operators can pin high-priority sensors to
the top, switch between Celsius and Fahrenheit without resetting the history,
choose the polling interval (2/5/10 seconds) and export the captured timeline as
CSV for offline analysis. All preferences persist via `localStorage` so that the
page restores the previous state on reload.

## Installing the bundle in Cockpit

1. Build the project:
   ```bash
   npm run build
   ```
2. Copy the generated `dist/` directory to your Cockpit installation. On most
   systems this is `/usr/share/cockpit/sensors`:
   ```bash
   sudo mkdir -p /usr/share/cockpit/sensors
   sudo cp -r dist/* /usr/share/cockpit/sensors/
   ```
3. Refresh the Cockpit UI in your browser. The Sensors entry should now be
   available in the navigation menu.

To remove a development installation that was linked with `~/.local/share`,
delete the directory or symlink:

```bash
rm -rf ~/.local/share/cockpit/sensors
```

## Testing and linting

- `npm run test` executes the full [Vitest](https://vitest.dev/) suite. Use
  `npm run test -- --watch` or `npm run test:watch` for an interactive loop.
- `npm run lint` runs ESLint using the repository configuration. To lint styles,
  run Stylelint directly: `npx stylelint "src/**/*.scss"`.

Always run both commands before sending changes for review or release.

## Releasing

1. Ensure the Vitest suite and lint checks pass.
2. Run `npm run build` to create the production bundle.
3. Package and distribute `dist/` (for example as a tarball, Debian package or
   RPM) through your preferred channels.

For Cockpit packaging details refer to the [official documentation](https://cockpit-project.org/guide/latest/).

## Contributing

Contributions are welcome! Please see our contributing guidelines:

- [English](CONTRIBUTING_EN.md)
- [Espa&ntilde;ol](CONTRIBUTING.md)
