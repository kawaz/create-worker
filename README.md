# @kawaz/create-worker

Create Web Workers from inline functions without requiring separate worker files.

[![npm version](https://badge.fury.io/js/%40kawaz%2Fcreate-worker.svg)](https://badge.fury.io/js/%40kawaz%2Fcreate-worker)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🎯 Create Workers from inline functions
- 📦 No external dependencies
- 💪 TypeScript support out of the box
- 🔄 Automatic fallback between Data URL and Object URL
- ✨ Type-safe messaging

## Installation

```bash
npm install @kawaz/create-worker
```

## Basic Usage

```typescript
import { createWorker } from '@kawaz/create-worker';

// Create a worker from a function
const worker = await createWorker(() => {
  // This is the worker code
  self.onmessage = (e) => {
    const result = e.data * 2;
    self.postMessage(result);
  };
});

// Use the worker
worker.postMessage(21);
worker.onmessage = (e) => {
  console.log(e.data); // Outputs: 42
};
```

## Important Notes

### Function Restrictions

The worker function must be self-contained and cannot reference any external variables or closures, as it will be stringified at runtime:

```typescript
// ❌ Bad - references external variable
const multiplier = 2;
const worker = await createWorker(() => {
  self.postMessage(5 * multiplier); // This will fail. ReferenceError: multiplier is not defined
});

// ✅ Good - all variables are contained within the function
const worker = await createWorker(() => {
  const multiplier = 2;
  self.postMessage(5 * multiplier);
});
```

## Security

- Never pass untrusted functions to `createWorker`
- Be aware that the function code will be converted to a string
- Consider your Content Security Policy (CSP) settings

### CSP Configuration

If your site uses Content Security Policy (CSP), you'll need to add either `data:` or `blob:` to the `worker-src` directive.

Example:

```http
Content-Security-Policy: default-src 'self'; worker-src 'self' data:
```

## API Reference

### createWorker

```typescript
function createWorker(
  workerMain: () => void,
  options?: WorkerOptions
): Promise<Worker>
```

#### Parameters

- `workerMain`: Function to be executed in the worker
  - Must be a self-contained function
  - Cannot reference variables from outer scope
  - Will be stringified at runtime

- `options`: Standard WorkerOptions object (optional)
  - `name`: Worker name
  - `type`: Worker type ('classic' | 'module')
  - Other standard WorkerOptions properties

#### Returns

Returns a Promise that resolves with a Worker instance.

#### Throws

- `AggregateError`: If worker creation fails using both Data URL and Object URL approaches

## Development

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Build
bun run build

# Lint/Format
bun run lint
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Worker Creation Fails

1. Check that your function doesn't reference external variables
2. Verify CSP settings if using in a web application
3. Ensure browser compatibility
4. Check console for detailed error messages

### Memory Leaks

- Workers are not automatically terminated
- Call `worker.terminate()` when done

## License

MIT © [Yoshiaki Kawazu](https://github.com/kawaz)

## Author

[Yoshiaki Kawazu](https://github.com/kawaz)

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check [issues page](https://github.com/kawaz/create-worker/issues).

## Support

If you like this project, please consider supporting it by giving a ⭐️ on GitHub!
