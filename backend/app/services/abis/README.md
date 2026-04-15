# Contract ABIs

These JSON files are generated — do not edit manually.

After compiling the contracts, run:

```bash
cd ../../blockchain
npm run compile
npm run export-abis
```

This copies `GrievanceSystem.json`, `RoleManager.json`, and
`GrievanceFactory.json` into this directory.

The backend will fail to start if these files are missing.
