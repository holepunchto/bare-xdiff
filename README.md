# bare-xdiff

Native bindings for libxdiff in Bare. Provides both asynchronous and synchronous APIs for diffing and merging text data.

```bash
npm install bare-xdiff
```

## Usage

```js
const { diff, merge, diffSync, mergeSync } = require('bare-xdiff')
const b4a = require('b4a')

// Async API
const patch = await diff(originalBuffer, modifiedBuffer)
const result = await merge(ancestorBuffer, oursBuffer, theirsBuffer)

// Sync API  
const patch = diffSync(originalBuffer, modifiedBuffer)
const result = mergeSync(ancestorBuffer, oursBuffer, theirsBuffer)
```

## API

### `diff(a, b[, options])`

Generates a unified diff patch from two buffer inputs.

- `a` - Original data (Uint8Array)
- `b` - Modified data (Uint8Array)
- `options` - Optional diff options

Returns a `Promise<Uint8Array>` containing the diff patch.

#### Options

- `ignoreWhitespace` - Ignore all whitespace differences
- `ignoreWhitespaceChange` - Ignore changes in amount of whitespace
- `ignoreWhitespaceAtEol` - Ignore whitespace at end of line
- `ignoreBlankLines` - Ignore blank line changes
- `algorithm` - Diff algorithm: `'minimal'`, `'patience'`, or `'histogram'`

### `merge(ancestor, ours, theirs[, options])`

Performs a three-way merge of buffers.

- `ancestor` - Original/ancestor data (Uint8Array)
- `ours` - Our changes data (Uint8Array)
- `theirs` - Their changes data (Uint8Array)
- `options` - Optional merge options

Returns a `Promise<{conflict: boolean, output: Uint8Array}>` containing conflict status and merged data.

#### Options

- `level` - Merge level: `'minimal'`, `'eager'`, `'zealous'`, or `'zealous_alnum'`
- `favor` - Conflict resolution: `'ours'`, `'theirs'`, or `'union'` 
- `style` - Output style: `'normal'`, `'diff3'`, or `'zealous_diff3'`
- `markerSize` - Conflict marker size (default: 7)

### `diffSync(a, b[, options])`

Synchronous version of `diff()`. Returns a `Uint8Array` directly.

### `mergeSync(ancestor, ours, theirs[, options])`

Synchronous version of `merge()`. Returns a `{conflict: boolean, output: Uint8Array}` directly.

## Examples

### Basic Diffing

```js
const { diff } = require('bare-xdiff')
const b4a = require('b4a')

const a = b4a.from('hello world\n')
const b = b4a.from('hello bare\n')

const patch = await diff(a, b)
console.log(b4a.toString(patch))
// Output:
// @@ -1 +1 @@
// -hello world
// +hello bare
```

### Whitespace Options

```js
const { diff } = require('bare-xdiff')
const b4a = require('b4a')

const a = b4a.from('hello world\n')
const b = b4a.from('hello  world\n') // extra space

const patch = await diff(a, b, { ignoreWhitespaceChange: true })
console.log(patch.length) // 0 - no differences found
```

### Algorithm Comparison

```js
const { diff } = require('bare-xdiff')
const b4a = require('b4a')

const a = b4a.from('line1\nline2\nline3\n')
const b = b4a.from('line1\nmodified\nline3\n')

const minimal = await diff(a, b, { algorithm: 'minimal' })
const patience = await diff(a, b, { algorithm: 'patience' }) 
const histogram = await diff(a, b, { algorithm: 'histogram' })
```

### Three-Way Merge

```js
const { merge } = require('bare-xdiff')
const b4a = require('b4a')

const ancestor = b4a.from('original\nline\n')
const ours = b4a.from('our\nline\n')
const theirs = b4a.from('original\ntheir line\n')

const result = await merge(ancestor, ours, theirs)
console.log(b4a.toString(result.output))
console.log('Conflict detected:', result.conflict)
// Output includes merged content or conflict markers
```

### Merge with Conflict Resolution

```js
const { merge } = require('bare-xdiff')
const b4a = require('b4a')

// Always favor our changes in conflicts
const result = await merge(ancestor, ours, theirs, { favor: 'ours' })
console.log('Conflict detected:', result.conflict)

// Use diff3 style conflict markers
const result = await merge(ancestor, ours, theirs, { style: 'diff3' })
console.log('Conflict detected:', result.conflict)
```

### Synchronous Operations

```js
const { diffSync, mergeSync } = require('bare-xdiff')
const b4a = require('b4a')

// Blocking operations - no async/await needed
const patch = diffSync(bufferA, bufferB)
const result = mergeSync(ancestor, ours, theirs)
console.log('Conflict detected:', result.conflict)
```

## Performance

Use the sync API for better performance on small to medium files. Use the async API for large files or when you need to avoid blocking the event loop.

## License

Apache-2.0
