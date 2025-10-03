# Cockpit Sensors

Cockpit Sensors is a [Cockpit](https://cockpit-project.org/) module that displays
telemetry provided by `lm-sensors`. The project ships a browser bundle that can
be installed on any host running Cockpit and offers a development environment
based on Vite, React and PatternFly.

## Requirements

- **Node.js 20.x** (the codebase is tested with Node 20; earlier versions are
  not supported).
- **npm 10** (ships with Node 20) with access to the public npm registry.
- Optional but recommended: `make`, `gettext` and a working Cockpit instance for
  integration tests.

Install dependencies once per clone with:

```bash
npm ci
```

> ℹ️ `npm ci` removes existing `node_modules/` and reproduces the lockfile state
> exactly, which keeps the development environment deterministic.

## Development workflow

| Task | Command |
| ---- | ------- |
| Start the development server with file watching | `npm run dev`
| Build the production bundle | `npm run build`
| Run the Vitest suite with coverage | `npm run test`
| Run ESLint over the repository | `npm run lint`

### Mock data with `VITE_MOCK`

When developing without a running Cockpit backend you can ask the application to
return mocked data:

```bash
VITE_MOCK=true npm run dev
```

`VITE_MOCK` is also honoured by the production build (`npm run build`) if you
need to ship a bundle with mock values for demos.

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
