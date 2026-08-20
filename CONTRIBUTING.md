# Contributing Guide: RAVAGE 🔒

Thanks for your interest in improving **Ravage**! As an open project, we welcome any kind of help, from reporting bugs to proposing new cryptographic features or UI improvements.

## 🚀 Getting started

1.  **Fork** the repository.
2.  **Clone** your fork locally: `git clone https://github.com/your-username/Ravage.git`.
3.  **Install dependencies**: `npm install`.
4.  **Set up your environment**:
    ```bash
    cp Docs/env_doc/.env.secret.example env/.env.secret
    cp Docs/env_doc/.env.config.example env/.env.config
    ```
    Fill both files in with your own test credentials (MongoDB Atlas, Brevo, etc.). On first launch, these plaintext files are automatically migrated into an OS-encrypted vault (`backend/utils/env_vault.js`) and removed — see [`Docs/architecture/BUILD_AND_ENVIRONMENT.md`](./Docs/architecture/BUILD_AND_ENVIRONMENT.md#4-environment-variables-and-the-secrets-vault) for the full mechanism.
5.  **Get familiar with the codebase**: the full technical documentation lives in [`Docs/`](./Docs/README.md) (architecture, encryption, data layer, IPC, frontend, etc.) — worth a skim before making non-trivial changes.

## 🛠 Development process

- **Branches**: create a descriptive branch for your change: `git checkout -b feature/specific-improvement` or `git checkout -b fix/bug-found`.
- **Code style**: we generally follow standard JavaScript (ESM) conventions. `standard` is included as a dev dependency for linting, though it isn't yet wired up as an `npm` script — run it directly with `npx standard` if you want to check your changes.
- **Tests**: if you add new logic to `cryptoService`, `validadores`, or similar core modules, add a unit test under `backend/tests/` and run the suite with `npm run test`.

## 📍 What you can contribute

- **Security**: audits of the Ratchet protocol or suggestions to improve AES-GCM encryption.
- **Frontend**: improvements to the Electron UI, animations, or accessibility.
- **Backend**: repository refactoring, Mongoose query optimization, or improvements to the cache system.
- **Tests**: adding tests for existing or new functionality.
- **Documentation**: improvements to `Docs/`.
- **Logging**: improvements to the logging system.
- **Rate limiting**: improvements to the rate-limiting system.
- **Servers**: improvements to the server implementations.

**Note**: if you want to work on something else, feel free to propose it. Most of the ideas and things that will be developed/changed/implemented in the app aren't tracked anywhere public (no Issues, no roadmap), so don't be discouraged if what you want to do isn't listed in the repository.

## 📤 Submitting your changes

1.  **Push** your branch to your fork.
2.  Open a **Pull Request** detailing:
    - What problem it solves.
    - What technical changes you made.
    - How you verified it.

---

**Legal note**: by contributing, you agree that your code will be licensed under Ravage's **ISC License**.
