# Contributing to @vanar/xbpp

Thanks for your interest in contributing to xBPP. This document covers the development setup and contribution process.

## Development Setup

```bash
git clone https://github.com/VanarChain/xbpp-sdk.git
cd xbpp-sdk
npm install
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Build CJS + ESM output to `dist/` |

## Running Tests

Tests use [Vitest](https://vitest.dev/). All tests must pass before submitting a PR.

```bash
npm test
```

## Project Structure

```
src/
  index.ts          - Public API exports
  evaluator.ts      - Core policy engine (12 checks)
  wrapper.ts        - fetch() interceptor for x402 headers
  errors.ts         - BlockedError + EscalateError classes
  types.ts          - TypeScript interfaces
  policies/         - Preset policy objects (aggressive, balanced, risk-averse)
  __tests__/        - Test files
```

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-change`)
3. Make your changes
4. Ensure tests pass (`npm test`)
5. Ensure the build succeeds (`npm run build`)
6. Submit a pull request against `main`

## Guidelines

- Keep the SDK dependency-free (zero runtime dependencies)
- Add tests for new functionality
- Follow existing code style (strict TypeScript, no `any` in core logic)
- Keep PRs focused - one feature or fix per PR

## Reporting Issues

For SDK bugs and feature requests, use [GitHub Issues](https://github.com/VanarChain/xbpp-sdk/issues).

For protocol specification feedback, visit [xbpp.org](https://xbpp.org) or contact the xBPP team.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
