# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in `@vanar/xbpp`, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

### How to report

1. **Email:** Send details to [security@vanarchain.com](mailto:security@vanarchain.com)
2. **GitHub:** Open a [private security advisory](https://github.com/VanarChain/xbpp-sdk/security/advisories/new) on the repository

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment:** Within 48 hours of receiving the report
- **Initial assessment:** Within 5 business days
- **Fix and disclosure:** We aim to release a patch within 14 days for confirmed vulnerabilities

### What qualifies as a security issue

For this package, security issues include:

- Policy bypass: any input that causes the evaluator to return `ALLOW` when it should return `BLOCK` or `ESCALATE`
- Transaction history manipulation: ways to tamper with or reset the in-memory history outside of intended APIs
- Injection attacks via `PaymentRequest` fields (recipient, currency, metadata) that could cause unintended behavior
- Dependency vulnerabilities that affect the package's runtime behavior
- Information leakage through error messages or verdict objects

### What does NOT qualify

- Denial of service via high-volume calls (the package is designed for single-process use)
- Issues in example code that is not part of the published package
- Feature requests or general bugs (use the issue tracker instead)
