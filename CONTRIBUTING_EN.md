# Contributing to Cockpit Sensors

Thank you for wanting to improve Cockpit Sensors! This document summarizes the
guidelines for proposing changes in a way that is consistent with the project's
philosophy.

## Philosophy

- **Less magic, fewer dependencies.** Prefer explicit solutions and avoid adding
  packages unless there is a clear technical justification.
- **Compatibility first.** Ensure that new features work with the supported
  versions of Node and Cockpit (currently Node 20).
- **Document what you change.** If you introduce new behaviors or flows, update
  the README or other relevant documentation.

## Workflow

1. Create a branch from `main` using the appropriate prefix: `feature/*` for new
   features or `fix/*` for bug fixes.
2. Install dependencies with `npm ci` and always work against Node 20.x.
3. Make commits following [Conventional Commits](https://www.conventionalcommits.org/).
4. Before opening a Pull Request, verify that everything passes:
   ```bash
   npm run lint
   npm run test
   npm run build
   ```
   Add new tests or mocks when necessary to cover the modified functionality.
5. Include in the PR description a clear summary, known risks, and any relevant
   decisions.

## Code Style

- Use TypeScript or modern JavaScript with ES modules (`"type": "module"`).
- Follow the rules defined by ESLint and Stylelint. You can automatically fix
  problems with `npx eslint . --fix` and `npx stylelint "src/**/*.scss" --fix`.
- Prefer small components and hooks with single responsibilities.
- Avoid hardcoding credentials, secrets, or paths to external systems.

## Testing

- Use [Vitest](https://vitest.dev/) and Testing Library to test components and
  hooks. Run `npm run test` regularly while developing.
- When adding critical functionality, accompany it with unit or integration tests
  that can be run in CI.
- Don't forget to run `npm run lint` to ensure consistent style.

## Reviews

- Respond to review comments with additional commits (also following Conventional
  Commits) or clear explanations.
- Keep changes focused: avoid mixing broad refactors with new features.
- Before merging, re-run the test and build commands to ensure nothing broke
  during the review.

Thank you for collaborating and keeping the project healthy.
