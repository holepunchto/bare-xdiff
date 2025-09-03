# bare-xdiff

High-performance libxdiff bindings for Bare, providing asynchronous diff, patch, and merge operations on in-memory buffers.

## Installation

```bash
npm install bare-xdiff
```

## Usage

```javascript
const { diff, patch, merge } = require('bare-xdiff')

// Generate a diff between two buffers
const original = Buffer.from('hello world\n')
const modified = Buffer.from('hello bare\n')
const diffResult = await diff(original, modified)

// Apply a patch to a buffer
const patched = await patch(original, diffResult)
console.log(patched.toString()) // 'hello bare\n'

// Three-way merge
const ancestor = Buffer.from('base content\n')
const ours = Buffer.from('our changes\n')
const theirs = Buffer.from('their changes\n')
const merged = await merge(ancestor, ours, theirs)
```

## API

### `async diff(a, b)`

Generates a unified diff between two buffers.

- `a` (Buffer | ArrayBuffer): The original buffer
- `b` (Buffer | ArrayBuffer): The modified buffer
- Returns: Promise<Buffer> - The diff in unified format

### `async patch(original, patchBuffer)`

Applies a patch to a buffer.

- `original` (Buffer | ArrayBuffer): The original buffer
- `patchBuffer` (Buffer | ArrayBuffer): The patch to apply
- Returns: Promise<Buffer> - The patched result

### `async merge(ancestor, ours, theirs)`

Performs a three-way merge.

- `ancestor` (Buffer | ArrayBuffer): The common ancestor
- `ours` (Buffer | ArrayBuffer): Our version
- `theirs` (Buffer | ArrayBuffer): Their version
- Returns: Promise<Buffer> - The merged result (may contain conflict markers)

## Features

- **Asynchronous Operations**: All operations run on worker threads to avoid blocking the event loop
- **In-Memory Only**: Works exclusively with buffers, no file I/O
- **Promise-Based API**: Modern async/await interface
- **High Performance**: Native C implementation using libxdiff from libgit2

## License

Apache-2.0