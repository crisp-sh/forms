# Forms

- Use npm. Run `npm run verify` before handoff.
- GitHub writes use `seIIers`; verify with `gh auth status --active`.
- `packages/forms` consumes Standard Schema v1 without schema-provider imports. Provider-specific adapters and examples belong in `examples/`.
- `scripts/upstream.json` preserves the original extraction's source commit and hashes as historical provenance, not a freeze on ongoing development.
- Put examples in `examples/` and tests outside the extracted package.
- `packages/config` supplies the original shared TypeScript configuration.
- Do not add a backend, production deployment, or registry publishing without a request.
