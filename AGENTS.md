# Forms

- Use npm. Run `npm run verify` before handoff.
- GitHub writes use `seIIers`; verify with `gh auth status --active`.
- `packages/forms` is a verbatim extraction. Preserve every file, including the manifest and prototype. Source commit and hashes live in `scripts/upstream.json`.
- Put examples in `examples/` and tests outside the extracted package.
- `packages/config` supplies the original shared TypeScript configuration.
- Do not add a backend, production deployment, or registry publishing without a request.
