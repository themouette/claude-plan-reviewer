## Code Quality

Always run the following before committing:

```bash
cargo fmt
cargo clippy -- -D warnings
```

Both checks are enforced by the pre-commit hook in `.githooks/`. After cloning, activate it with:

```bash
git config core.hooksPath .githooks
```
