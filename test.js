const test = require('brittle')
const { diff, patch, merge } = require('.')

test('diff - simple text change', async (t) => {
  const a = Buffer.from('hello world\n')
  const b = Buffer.from('hello bare\n')
  
  const result = await diff(a, b)
  const diffStr = result.toString()
  
  t.ok(diffStr.includes('hello world'), 'contains original line')
  t.ok(diffStr.includes('hello bare'), 'contains modified line')
})

test('diff - multiple line changes', async (t) => {
  const a = Buffer.from('line1\nline2\nline3\n')
  const b = Buffer.from('line1\nmodified2\nline3\n')
  
  const result = await diff(a, b)
  const diffStr = result.toString()
  
  t.ok(diffStr.includes('line2'), 'contains original line2')
  t.ok(diffStr.includes('modified2'), 'contains modified line2')
})

test('diff - identical buffers', async (t) => {
  const a = Buffer.from('same content\n')
  const b = Buffer.from('same content\n')
  
  const result = await diff(a, b)
  t.is(result.length, 0, 'no diff for identical content')
})

test('diff - empty buffers', async (t) => {
  const a = Buffer.alloc(0)
  const b = Buffer.alloc(0)
  
  const result = await diff(a, b)
  t.is(result.length, 0, 'no diff for empty buffers')
})

test('diff - from empty to content', async (t) => {
  const a = Buffer.alloc(0)
  const b = Buffer.from('new content\n')
  
  const result = await diff(a, b)
  const diffStr = result.toString()
  
  t.ok(result.length > 0, 'has diff content')
  t.ok(diffStr.includes('new content'), 'shows added content')
})

test('diff - from content to empty', async (t) => {
  const a = Buffer.from('old content\n')
  const b = Buffer.alloc(0)
  
  const result = await diff(a, b)
  const diffStr = result.toString()
  
  t.ok(result.length > 0, 'has diff content')
  t.ok(diffStr.includes('old content'), 'shows removed content')
})

test('diff - handles ArrayBuffer input', async (t) => {
  const a = new Uint8Array([104, 101, 108, 108, 111]).buffer // "hello"
  const b = new Uint8Array([119, 111, 114, 108, 100]).buffer // "world"
  
  const result = await diff(a, b)
  t.ok(result instanceof Buffer, 'returns a Buffer')
  t.ok(result.length > 0, 'has diff content')
})

test('patch - apply simple patch', async (t) => {
  const original = Buffer.from('hello world\n')
  const modified = Buffer.from('hello bare\n')
  
  const patchBuffer = await diff(original, modified)
  const patched = await patch(original, patchBuffer)
  
  t.alike(patched, modified, 'patch correctly applied')
})

test('patch - apply multi-line patch', async (t) => {
  const original = Buffer.from('line1\nline2\nline3\n')
  const modified = Buffer.from('line1\nmodified2\nline3\nadded4\n')
  
  const patchBuffer = await diff(original, modified)
  const patched = await patch(original, patchBuffer)
  
  t.alike(patched, modified, 'multi-line patch correctly applied')
})

test('patch - empty patch on identical content', async (t) => {
  const original = Buffer.from('unchanged\n')
  const patchBuffer = await diff(original, original)
  
  const patched = await patch(original, patchBuffer)
  t.alike(patched, original, 'unchanged content remains unchanged')
})

test('patch - handles ArrayBuffer input', async (t) => {
  const original = new Uint8Array([104, 101, 108, 108, 111]).buffer
  const modified = new Uint8Array([119, 111, 114, 108, 100]).buffer
  
  const patchBuffer = await diff(original, modified)
  const patched = await patch(original, patchBuffer)
  
  t.ok(patched instanceof Buffer, 'returns a Buffer')
})

test('merge - no conflicts', async (t) => {
  const ancestor = Buffer.from('line1\nline2\nline3\n')
  const ours = Buffer.from('line1\nmodified2\nline3\n')
  const theirs = Buffer.from('line1\nline2\nmodified3\n')
  
  const result = await merge(ancestor, ours, theirs)
  const mergeStr = result.toString()
  
  t.ok(mergeStr.includes('modified2'), 'includes our change')
  t.ok(mergeStr.includes('modified3'), 'includes their change')
  t.not(mergeStr.includes('<<<'), 'no conflict markers')
})

test('merge - with conflicts', async (t) => {
  const ancestor = Buffer.from('original line\n')
  const ours = Buffer.from('our change\n')
  const theirs = Buffer.from('their change\n')
  
  const result = await merge(ancestor, ours, theirs)
  const mergeStr = result.toString()
  
  t.ok(mergeStr.includes('<<<'), 'has conflict start marker')
  t.ok(mergeStr.includes('==='), 'has conflict separator')
  t.ok(mergeStr.includes('>>>'), 'has conflict end marker')
  t.ok(mergeStr.includes('our change'), 'includes our change')
  t.ok(mergeStr.includes('their change'), 'includes their change')
})

test('merge - identical changes', async (t) => {
  const ancestor = Buffer.from('original\n')
  const ours = Buffer.from('modified\n')
  const theirs = Buffer.from('modified\n')
  
  const result = await merge(ancestor, ours, theirs)
  const mergeStr = result.toString()
  
  t.alike(result, ours, 'identical changes merge cleanly')
  t.not(mergeStr.includes('<<<'), 'no conflict markers')
})

test('merge - empty buffers', async (t) => {
  const ancestor = Buffer.alloc(0)
  const ours = Buffer.alloc(0)
  const theirs = Buffer.alloc(0)
  
  const result = await merge(ancestor, ours, theirs)
  t.is(result.length, 0, 'empty merge for empty buffers')
})

test('merge - one side adds content', async (t) => {
  const ancestor = Buffer.from('base\n')
  const ours = Buffer.from('base\nadded by us\n')
  const theirs = Buffer.from('base\n')
  
  const result = await merge(ancestor, ours, theirs)
  const mergeStr = result.toString()
  
  t.ok(mergeStr.includes('added by us'), 'includes our addition')
  t.not(mergeStr.includes('<<<'), 'no conflict markers')
})

test('merge - handles ArrayBuffer input', async (t) => {
  const ancestor = new Uint8Array([97]).buffer // "a"
  const ours = new Uint8Array([98]).buffer // "b"
  const theirs = new Uint8Array([99]).buffer // "c"
  
  const result = await merge(ancestor, ours, theirs)
  t.ok(result instanceof Buffer, 'returns a Buffer')
  t.ok(result.length > 0, 'has merge content')
})

test('concurrent operations', async (t) => {
  const promises = []
  
  // Run multiple operations concurrently
  for (let i = 0; i < 10; i++) {
    const a = Buffer.from(`content ${i}\n`)
    const b = Buffer.from(`modified ${i}\n`)
    promises.push(diff(a, b))
  }
  
  const results = await Promise.all(promises)
  
  t.is(results.length, 10, 'all operations completed')
  results.forEach((result, i) => {
    t.ok(result.toString().includes(`content ${i}`), `diff ${i} contains original`)
    t.ok(result.toString().includes(`modified ${i}`), `diff ${i} contains modified`)
  })
})

test('error handling - diff with non-buffer throws', async (t) => {
  await t.exception(async () => {
    await diff('not a buffer', 'also not')
  }, 'should handle non-buffer input')
})

test('large buffer handling', async (t) => {
  const size = 100000
  const a = Buffer.alloc(size).fill('a')
  const b = Buffer.alloc(size).fill('b')
  
  const result = await diff(a, b)
  t.ok(result.length > 0, 'handles large buffers')
})

test('unicode content handling', async (t) => {
  const a = Buffer.from('Hello 世界 🌍\n')
  const b = Buffer.from('Hello 世界 🌎\n')
  
  const result = await diff(a, b)
  const diffStr = result.toString()
  
  t.ok(result.length > 0, 'handles unicode content')
  t.ok(diffStr.includes('🌍') || diffStr.includes('🌎'), 'preserves unicode characters')
})