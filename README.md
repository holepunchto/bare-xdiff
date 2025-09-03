# bare-xdiff

Native bindings for libxdiff in Bare. Provides both asynchronous and synchronous APIs for diffing and merging text data.

```bash
npm install bare-xdiff
```

## Usage

```js
const { diff, merge, diffSync, mergeSync } = require('bare-xdiff')

// Async API
const patch = await diff(originalText, modifiedText)
const merged = await merge(ancestorText, oursText, theirsText)

// Sync API  
const patch = diffSync(originalText, modifiedText)
const merged = mergeSync(ancestorText, oursText, theirsText)
```

## API

### `diff(a, b[, options])`

Generates a unified diff patch from two text inputs.

- `a` - Original text (String)
- `b` - Modified text (String)
- `options` - Optional diff options

Returns a `Promise<String>` containing the diff patch.

#### Options

- `ignoreWhitespace` - Ignore all whitespace differences
- `ignoreWhitespaceChange` - Ignore changes in amount of whitespace
- `ignoreWhitespaceAtEol` - Ignore whitespace at end of line
- `ignoreBlankLines` - Ignore blank line changes
- `algorithm` - Diff algorithm: `'minimal'`, `'patience'`, or `'histogram'`

### `merge(ancestor, ours, theirs[, options])`

Performs a three-way merge of text.

- `ancestor` - Original/ancestor text (String)
- `ours` - Our changes text (String)
- `theirs` - Their changes text (String)
- `options` - Optional merge options

Returns a `Promise<String>` containing the merged result.

#### Options

- `level` - Merge level: `'minimal'`, `'eager'`, `'zealous'`, or `'zealous_alnum'`
- `favor` - Conflict resolution: `'ours'`, `'theirs'`, or `'union'` 
- `style` - Output style: `'normal'`, `'diff3'`, or `'zealous_diff3'`
- `markerSize` - Conflict marker size (default: 7)

### `diffSync(a, b[, options])`

Synchronous version of `diff()`. Returns a `String` directly.

### `mergeSync(ancestor, ours, theirs[, options])`

Synchronous version of `merge()`. Returns a `String` directly.

## Examples

### Basic Diffing

```js
const { diff } = require('bare-xdiff')

const a = 'hello world\n'
const b = 'hello bare\n'

const patch = await diff(a, b)
console.log(patch)
// Output:
// @@ -1 +1 @@
// -hello world
// +hello bare
```

### Whitespace Options

```js
const { diff } = require('bare-xdiff')

const a = 'hello world\n'
const b = 'hello  world\n' // extra space

const patch = await diff(a, b, { ignoreWhitespaceChange: true })
console.log(patch.length) // 0 - no differences found
```

### Algorithm Comparison

```js
const { diff } = require('bare-xdiff')

const a = 'line1\nline2\nline3\n'
const b = 'line1\nmodified\nline3\n'

const minimal = await diff(a, b, { algorithm: 'minimal' })
const patience = await diff(a, b, { algorithm: 'patience' }) 
const histogram = await diff(a, b, { algorithm: 'histogram' })
```

### Three-Way Merge

```js
const { merge } = require('bare-xdiff')

const ancestor = 'original\nline\n'
const ours = 'our\nline\n'
const theirs = 'original\ntheir line\n'

const result = await merge(ancestor, ours, theirs)
console.log(result)
// Output includes merged content or conflict markers
```

### Merge with Conflict Resolution

```js
const { merge } = require('bare-xdiff')

// Always favor our changes in conflicts
const result = await merge(ancestor, ours, theirs, { favor: 'ours' })

// Use diff3 style conflict markers
const result = await merge(ancestor, ours, theirs, { style: 'diff3' })
```

### Synchronous Operations

```js
const { diffSync, mergeSync } = require('bare-xdiff')

// Blocking operations - no async/await needed
const patch = diffSync(textA, textB)
const merged = mergeSync(ancestor, ours, theirs)
```

## Performance

Use the sync API for better performance on small to medium files. Use the async API for large files or when you need to avoid blocking the event loop.

## License

Apache-2.0
