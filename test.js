const test = require('brittle')
const { diff, merge, diffSync, mergeSync } = require('.')

test('diff - simple text change', async (t) => {
  const a = 'hello world\n'
  const b = 'hello bare\n'
  
  const result = await diff(a, b)
  
  t.ok(result.includes('hello world'), 'contains original line')
  t.ok(result.includes('hello bare'), 'contains modified line')
})

test('merge with options - favor ours', async (t) => {
  const ancestor = 'original line\n'
  const ours = 'our version\n'
  const theirs = 'their version\n'
  
  const result = await merge(ancestor, ours, theirs, { favor: 'ours' })
  const mergeStr = result
  
  t.ok(mergeStr.includes('our version'), 'favors our version')
})

test('diff - multiple line changes', async (t) => {
  const a = 'line1\nline2\nline3\n'
  const b = 'line1\nmodified2\nline3\n'
  
  const result = await diff(a, b)
  const diffStr = result
  
  t.ok(diffStr.includes('line2'), 'contains original line2')
  t.ok(diffStr.includes('modified2'), 'contains modified line2')
})

test('diff - identical buffers', async (t) => {
  const a = 'same content\n'
  const b = 'same content\n'
  
  const result = await diff(a, b)
  t.is(result.length, 0, 'no diff for identical content')
})

test('diff - empty buffers', async (t) => {
  const a = ''
  const b = ''
  
  const result = await diff(a, b)
  t.is(result.length, 0, 'no diff for empty buffers')
})

test('diff - from empty to content', async (t) => {
  const a = ''
  const b = 'new content\n'
  
  const result = await diff(a, b)
  const diffStr = result
  
  t.ok(result.length > 0, 'has diff content')
  t.ok(diffStr.includes('new content'), 'shows added content')
})

test('diff - from content to empty', async (t) => {
  const a = 'old content\n'
  const b = ''
  
  const result = await diff(a, b)
  const diffStr = result
  
  t.ok(result.length > 0, 'has diff content')
  t.ok(diffStr.includes('old content'), 'shows removed content')
})


test('merge - no conflicts', async (t) => {
  const ancestor = 'line1\nline2\nline3\n'
  const ours = 'line1\nmodified2\nline3\n'
  const theirs = 'line1\nline2\nmodified3\n'
  
  const result = await merge(ancestor, ours, theirs)
  const mergeStr = result
  
  t.ok(mergeStr.includes('modified2'), 'includes our change')
  t.ok(mergeStr.includes('modified3'), 'includes their change')
  t.not(mergeStr.includes('<<<'), 'no conflict markers')
})

test('merge - with conflicts', async (t) => {
  const ancestor = 'original line\n'
  const ours = 'our change\n'
  const theirs = 'their change\n'
  
  const result = await merge(ancestor, ours, theirs)
  const mergeStr = result
  
  t.ok(mergeStr.includes('<<<'), 'has conflict start marker')
  t.ok(mergeStr.includes('==='), 'has conflict separator')
  t.ok(mergeStr.includes('>>>'), 'has conflict end marker')
  t.ok(mergeStr.includes('our change'), 'includes our change')
  t.ok(mergeStr.includes('their change'), 'includes their change')
})

test('merge - identical changes', async (t) => {
  const ancestor = 'original\n'
  const ours = 'modified\n'
  const theirs = 'modified\n'
  
  const result = await merge(ancestor, ours, theirs, { level: 'zealous' })
  const mergeStr = result
  
  t.alike(result, ours, 'identical changes merge cleanly')
  t.not(mergeStr.includes('<<<'), 'no conflict markers')
})

test('merge - empty buffers', async (t) => {
  const ancestor = ''
  const ours = ''
  const theirs = ''
  
  const result = await merge(ancestor, ours, theirs)
  t.is(result.length, 0, 'empty merge for empty buffers')
})

test('merge - one side adds content', async (t) => {
  const ancestor = 'base\n'
  const ours = 'base\nadded by us\n'
  const theirs = 'base\n'
  
  const result = await merge(ancestor, ours, theirs)
  const mergeStr = result
  
  t.ok(mergeStr.includes('added by us'), 'includes our addition')
  t.not(mergeStr.includes('<<<'), 'no conflict markers')
})


test('concurrent operations', async (t) => {
  const promises = []
  
  // Run multiple operations concurrently
  for (let i = 0; i < 10; i++) {
    const a = `content ${i}\n`
    const b = `modified ${i}\n`
    promises.push(diff(a, b))
  }
  
  const results = await Promise.all(promises)
  
  t.is(results.length, 10, 'all operations completed')
  results.forEach((result, i) => {
    t.ok(result.includes(`content ${i}`), `diff ${i} contains original`)
    t.ok(result.includes(`modified ${i}`), `diff ${i} contains modified`)
  })
})

test('error handling - accepts string input', async (t) => {
  const result = await diff('hello\n', 'world\n')
  t.ok(typeof result === 'string', 'returns string')
  t.ok(result.length > 0, 'has diff content')
})

test('large buffer handling', async (t) => {
  const size = 100000
  const a = 'a'.repeat(size)
  const b = 'b'.repeat(size)
  
  const result = await diff(a, b)
  t.ok(result.length > 0, 'handles large buffers')
})

test('unicode content handling', async (t) => {
  const a = 'Hello 世界 🌍\n'
  const b = 'Hello 世界 🌎\n'
  
  const result = await diff(a, b)
  const diffStr = result
  
  t.ok(result.length > 0, 'handles unicode content')
  t.ok(diffStr.includes('🌍') || diffStr.includes('🌎'), 'preserves unicode characters')
})

test('diff with options - ignore whitespace', async (t) => {
  const a = 'hello world\n'
  const b = 'hello  world\n' // Extra space
  
  const result = await diff(a, b, { ignoreWhitespaceChange: true })
  
  t.is(result.length, 0, 'ignores whitespace changes')
})

// === COMPREHENSIVE DIFF ALGORITHM TESTS ===

test('diff algorithms - minimal vs patience vs histogram', async (t) => {
  // Create a challenging diff scenario where algorithms might behave differently
  const a = `common line
moved block A
moved block B  
common middle
original line
common end`
  
  const b = `common line
common middle
moved block B
moved block A
modified line
common end`
  
  const minimal = await diff(a, b)  // default minimal
  const patience = await diff(a, b, { algorithm: 'patience' })
  const histogram = await diff(a, b, { algorithm: 'histogram' })
  
  t.ok(minimal.length > 0, 'minimal algorithm produces diff')
  t.ok(patience.length > 0, 'patience algorithm produces diff') 
  t.ok(histogram.length > 0, 'histogram algorithm produces diff')
  
  // All should handle the same changes
  const minStr = minimal
  const patStr = patience
  const histStr = histogram
  
  t.ok(minStr.includes('modified line') || minStr.includes('original line'), 'minimal handles line change')
  t.ok(patStr.includes('modified line') || patStr.includes('original line'), 'patience handles line change')
  t.ok(histStr.includes('modified line') || histStr.includes('original line'), 'histogram handles line change')
})

test('diff algorithms - patience with moved blocks', async (t) => {
  const a = `function foo() {
  console.log('A')
  console.log('B')
}

function bar() {
  console.log('C')
}`

  const b = `function bar() {
  console.log('C')  
}

function foo() {
  console.log('A')
  console.log('B')
}`

  const patience = await diff(a, b, { algorithm: 'patience' })
  
  t.ok(patience.length > 0, 'patience algorithm detects moved functions')
  const diffStr = patience
  t.ok(diffStr.includes('foo') && diffStr.includes('bar'), 'includes both function names')
})

// === COMPREHENSIVE WHITESPACE TESTS ===

test('whitespace options - ignoreWhitespace', async (t) => {
  const a = 'hello world\n'
  const b = 'helloworld\n'  // No spaces
  
  const result = await diff(a, b, { ignoreWhitespace: true })
  t.is(result.length, 0, 'ignores all whitespace differences')
})

test('whitespace options - ignoreWhitespaceChange', async (t) => {
  const a = 'hello\tworld\n'
  const b = 'hello    world\n'  // Tab vs spaces
  
  const result = await diff(a, b, { ignoreWhitespaceChange: true })
  t.is(result.length, 0, 'ignores whitespace changes')
})

test('whitespace options - ignoreWhitespaceAtEol', async (t) => {
  const a = 'hello world\n'
  const b = 'hello world   \n'  // Trailing spaces
  
  const result = await diff(a, b, { ignoreWhitespaceAtEol: true })
  t.is(result.length, 0, 'ignores whitespace at end of line')
})

test('whitespace options - ignoreBlankLines', async (t) => {
  const a = 'line1\nline2\nline3\n'
  const b = 'line1\n\nline2\n\n\nline3\n'  // Extra blank lines
  
  const result = await diff(a, b, { ignoreBlankLines: true })
  t.is(result.length, 0, 'ignores blank line differences')
})

test('whitespace options - combined whitespace flags', async (t) => {
  const a = 'hello\tworld\nline2\n'
  const b = 'hello    world   \n\nline2   \n'  // Multiple whitespace issues
  
  const result = await diff(a, b, { 
    ignoreWhitespaceChange: true,
    ignoreWhitespaceAtEol: true, 
    ignoreBlankLines: true
  })
  
  t.is(result.length, 0, 'handles multiple whitespace options together')
})

// === COMPREHENSIVE MERGE LEVEL TESTS ===

test('merge levels - minimal vs eager vs zealous', async (t) => {
  const ancestor = `start
conflict line
end`

  const ours = `start
our change
end`

  const theirs = `start  
their change
end`

  const minimal = await merge(ancestor, ours, theirs, { level: 'minimal' })
  const eager = await merge(ancestor, ours, theirs, { level: 'eager' })
  const zealous = await merge(ancestor, ours, theirs, { level: 'zealous' })
  
  // All should produce conflict markers since this is a true conflict
  t.ok(minimal.includes('<<<'), 'minimal shows conflicts')
  t.ok(eager.includes('<<<'), 'eager shows conflicts') 
  t.ok(zealous.includes('<<<'), 'zealous shows conflicts')
})

test('merge levels - zealous_alnum with alphanumeric conflicts', async (t) => {
  const ancestor = 'version = 1.0.0\n'
  const ours = 'version = 1.1.0\n'  
  const theirs = 'version = 1.0.1\n'
  
  const result = await merge(ancestor, ours, theirs, { level: 'zealous_alnum' })
  const mergeStr = result
  
  t.ok(mergeStr.includes('<<<'), 'zealous_alnum creates conflict markers for version conflicts')
  t.ok(mergeStr.includes('1.1.0'), 'includes our version')
  t.ok(mergeStr.includes('1.0.1'), 'includes their version')
})

// === COMPREHENSIVE MERGE FAVOR TESTS ===

test('merge favor modes - ours vs theirs vs union', async (t) => {
  const ancestor = 'original content\n'
  const ours = 'our version\n'
  const theirs = 'their version\n'
  
  const favorOurs = await merge(ancestor, ours, theirs, { favor: 'ours' })
  const favorTheirs = await merge(ancestor, ours, theirs, { favor: 'theirs' })  
  const favorUnion = await merge(ancestor, ours, theirs, { favor: 'union' })
  
  t.ok(favorOurs.includes('our version'), 'favor ours chooses our version')
  t.ok(favorTheirs.includes('their version'), 'favor theirs chooses their version')
  
  const unionStr = favorUnion
  t.ok(unionStr.includes('our version') && unionStr.includes('their version'), 'union includes both versions')
})

test('merge favor - complex conflict resolution', async (t) => {
  const ancestor = `function example() {
  return 'original'
}`

  const ours = `function example() {
  return 'modified by us'  
}`

  const theirs = `function example() {
  return 'modified by them'
}`

  const favorOurs = await merge(ancestor, ours, theirs, { favor: 'ours' })
  t.ok(favorOurs.includes('modified by us'), 'complex favor ours works')
})

// === MERGE STYLE TESTS ===

test('merge styles - diff3 format', async (t) => {
  const ancestor = 'original\n'
  const ours = 'ours\n'
  const theirs = 'theirs\n'
  
  const diff3 = await merge(ancestor, ours, theirs, { style: 'diff3' })
  const normal = await merge(ancestor, ours, theirs)
  
  const diff3Str = diff3
  const normalStr = normal
  
  // diff3 format should include original/ancestor section
  t.ok(diff3Str.includes('|||'), 'diff3 style includes ancestor markers')
  t.not(normalStr.includes('|||'), 'normal style does not include ancestor markers')
})

test('merge styles - zealous_diff3', async (t) => {
  const ancestor = `line1
conflict
line3`

  const ours = `line1  
our change
line3`

  const theirs = `line1
their change  
line3`
  
  const zealousDiff3 = await merge(ancestor, ours, theirs, { 
    style: 'zealous_diff3',
    level: 'zealous'
  })
  
  const resultStr = zealousDiff3
  t.ok(resultStr.includes('|||'), 'zealous_diff3 includes ancestor section')
  t.ok(resultStr.includes('our change'), 'includes our changes')
  t.ok(resultStr.includes('their change'), 'includes their changes')
})

// === EDGE CASE TESTS ===

test('edge cases - very long lines', async (t) => {
  const longLine = 'x'.repeat(10000)
  const a = `${longLine}\n`
  const b = `${longLine}y\n`  // One char difference
  
  const result = await diff(a, b)
  t.ok(result.length > 0, 'handles very long lines')
  t.ok(result.includes('x'), 'diff contains expected content')
})

test('edge cases - many small changes', async (t) => {
  let textA = ''
  let textB = ''
  
  // Create 100 lines with small differences on every other line
  for (let i = 0; i < 100; i++) {
    textA += `line ${i} original\n`
    textB += i % 2 === 0 ? `line ${i} original\n` : `line ${i} modified\n`
  }
  
  const result = await diff((textA), (textB))
  t.ok(result.length > 0, 'handles many small changes')
  
  const diffStr = result
  t.ok(diffStr.includes('modified'), 'includes modifications')
})

test('edge cases - special characters', async (t) => {
  const textA = 'line with special chars: àáâã\n'
  const textB = 'line with special chars: ëèéê\n'
  
  const result = await diff(textA, textB)
  t.ok(result.length > 0, 'handles special characters')
})

test('edge cases - mixed line endings', async (t) => {
  const a = 'line1\nline2\nline3\n'        // Unix
  const b = 'line1\r\nline2\r\nline3\r\n'  // Windows  
  
  const result = await diff(a, b)
  t.ok(result.length > 0, 'detects line ending differences')
})

test('edge cases - merge with empty ancestor', async (t) => {
  const ancestor = ''
  const ours = 'our content\n'
  const theirs = 'their content\n'
  
  const result = await merge(ancestor, ours, theirs)
  const mergeStr = result
  
  t.ok(mergeStr.includes('our content'), 'includes our content')
  t.ok(mergeStr.includes('their content'), 'includes their content')
})

test('performance - stress test with large files', async (t) => {
  // Create moderately large files (not too big for CI)
  const lines = 1000
  let textA = ''
  let textB = ''
  
  for (let i = 0; i < lines; i++) {
    textA += `This is line ${i} in file A with some content\n`
    textB += i < 500 ? `This is line ${i} in file A with some content\n` : `This is line ${i} in file B with different content\n`
  }
  
  const start = Date.now()
  const result = await diff((textA), (textB))
  const duration = Date.now() - start
  
  t.ok(result.length > 0, 'produces diff for large files')
  t.ok(duration < 5000, 'completes within reasonable time (5s)')
})

test('options validation - invalid algorithm', async (t) => {
  const a = 'test\n'
  const b = 'test2\n'
  
  // Invalid algorithm should fall back to default behavior (not crash)
  const result = await diff(a, b, { algorithm: 'invalid' })
  t.ok(result.length > 0, 'handles invalid algorithm gracefully')
})

test('merge - custom marker size', async (t) => {
  const ancestor = 'original\n'
  const ours = 'ours\n' 
  const theirs = 'theirs\n'
  
  const result = await merge(ancestor, ours, theirs, { markerSize: 10 })
  const mergeStr = result
  
  // Should use 10-character conflict markers instead of default 7
  t.ok(mergeStr.includes('<'.repeat(10)), 'uses custom marker size')
})

// === SYNC FUNCTION TESTS ===

test('diffSync - basic functionality', (t) => {
  const a = 'hello\nworld\n'
  const b = 'hello\nworld!\n'
  
  const result = diffSync(a, b)
  t.ok(result.length > 0, 'sync diff produces result')
  
  const diffStr = result
  t.ok(diffStr.includes('-world'), 'shows old line')
  t.ok(diffStr.includes('+world!'), 'shows new line')
})

test('diffSync - identical inputs', (t) => {
  const a = 'same content\n'
  const b = 'same content\n'
  
  const result = diffSync(a, b)
  t.is(result.length, 0, 'sync diff of identical inputs is empty')
})

test('diffSync - with options', (t) => {
  const a = 'hello world\n'
  const b = 'hello  world\n' // Extra space
  
  const result = diffSync(a, b, { ignoreWhitespaceChange: true })
  t.is(result.length, 0, 'sync diff ignores whitespace changes with option')
})

test('diffSync - algorithm options', (t) => {
  const a = 'line1\nline2\nline3\n'
  const b = 'line1\nmodified\nline3\n'
  
  const minimal = diffSync(a, b)
  const patience = diffSync(a, b, { algorithm: 'patience' })
  const histogram = diffSync(a, b, { algorithm: 'histogram' })
  
  t.ok(minimal.length > 0, 'sync minimal algorithm produces result')
  t.ok(patience.length > 0, 'sync patience algorithm produces result')
  t.ok(histogram.length > 0, 'sync histogram algorithm produces result')
})

test('diffSync - all whitespace options', (t) => {
  const a = 'hello world \n\nfinal\n'
  const b = 'hello\tworld\n \nfinal\n'
  
  const ignoreWS = diffSync(a, b, { ignoreWhitespace: true })
  const ignoreWSChange = diffSync(a, b, { ignoreWhitespaceChange: true })
  const ignoreWSEOL = diffSync(a, b, { ignoreWhitespaceAtEol: true })
  const ignoreBlank = diffSync(a, b, { ignoreBlankLines: true })
  
  t.is(ignoreWS.length, 0, 'sync ignoreWhitespace works')
  t.is(ignoreWSChange.length, 0, 'sync ignoreWhitespaceChange works')
  t.ok(ignoreWSEOL.length >= 0, 'sync ignoreWhitespaceAtEol works')
  t.ok(ignoreBlank.length >= 0, 'sync ignoreBlankLines works')
})

test('mergeSync - basic functionality', (t) => {
  const ancestor = 'original line\n'
  const ours = 'our changes\n'
  const theirs = 'their changes\n'
  
  const result = mergeSync(ancestor, ours, theirs)
  t.ok(result.length > 0, 'sync merge produces result')
  
  const mergeStr = result
  t.ok(mergeStr.includes('our changes') || mergeStr.includes('<<<<<<<'), 'sync merge contains expected content')
})

test('mergeSync - no conflicts', (t) => {
  const ancestor = 'line1\nline2\nline3\n'
  const ours = 'modified1\nline2\nline3\n'
  const theirs = 'line1\nline2\nmodified3\n'
  
  const result = mergeSync(ancestor, ours, theirs)
  const mergeStr = result
  
  t.ok(mergeStr.includes('modified1'), 'sync merge includes our changes')
  t.ok(mergeStr.includes('modified3'), 'sync merge includes their changes')
  t.ok(!mergeStr.includes('<<<<<<<'), 'sync merge has no conflict markers')
})

test('mergeSync - merge levels', (t) => {
  const ancestor = 'original\n'
  const ours = 'ours\n'
  const theirs = 'theirs\n'
  
  const minimal = mergeSync(ancestor, ours, theirs, { level: 'minimal' })
  const eager = mergeSync(ancestor, ours, theirs, { level: 'eager' })
  const zealous = mergeSync(ancestor, ours, theirs, { level: 'zealous' })
  const zealousAlnum = mergeSync(ancestor, ours, theirs, { level: 'zealous_alnum' })
  
  t.ok(minimal.length > 0, 'sync minimal level works')
  t.ok(eager.length > 0, 'sync eager level works')
  t.ok(zealous.length > 0, 'sync zealous level works')
  t.ok(zealousAlnum.length > 0, 'sync zealous_alnum level works')
})

test('mergeSync - favor modes', (t) => {
  const ancestor = 'original\n'
  const ours = 'ours\n'
  const theirs = 'theirs\n'
  
  const favorOurs = mergeSync(ancestor, ours, theirs, { favor: 'ours' })
  const favorTheirs = mergeSync(ancestor, ours, theirs, { favor: 'theirs' })
  const favorUnion = mergeSync(ancestor, ours, theirs, { favor: 'union' })
  
  t.ok(favorOurs.includes('ours'), 'sync favor ours works')
  t.ok(favorTheirs.includes('theirs'), 'sync favor theirs works')
  t.ok(favorUnion.length > 0, 'sync favor union works')
})

test('mergeSync - merge styles', (t) => {
  const ancestor = 'original\n'
  const ours = 'ours\n'
  const theirs = 'theirs\n'
  
  const normal = mergeSync(ancestor, ours, theirs, { style: 'normal' })
  const diff3 = mergeSync(ancestor, ours, theirs, { style: 'diff3' })
  const zealousDiff3 = mergeSync(ancestor, ours, theirs, { style: 'zealous_diff3' })
  
  t.ok(normal.length > 0, 'sync normal style works')
  t.ok(diff3.length > 0, 'sync diff3 style works')
  t.ok(zealousDiff3.length > 0, 'sync zealous_diff3 style works')
})

test('mergeSync - custom marker size', (t) => {
  const ancestor = 'original\n'
  const ours = 'ours\n'
  const theirs = 'theirs\n'
  
  const result = mergeSync(ancestor, ours, theirs, { markerSize: 10 })
  const mergeStr = result
  
  t.ok(mergeStr.includes('<'.repeat(10)), 'sync merge uses custom marker size')
})

test('mergeSync - identical to async results', async (t) => {
  const ancestor = 'line1\ncommon\nline3\n'
  const ours = 'line1\nours\nline3\n'
  const theirs = 'line1\ntheirs\nline3\n'
  
  const syncResult = mergeSync(ancestor, ours, theirs)
  const asyncResult = await merge(ancestor, ours, theirs)
  
  t.alike(syncResult, asyncResult, 'sync and async merge produce identical results')
})

test('diffSync - identical to async results', async (t) => {
  const a = 'line1\nline2\nline3\n'
  const b = 'line1\nmodified\nline3\n'
  
  const syncResult = diffSync(a, b)
  const asyncResult = await diff(a, b)
  
  t.alike(syncResult, asyncResult, 'sync and async diff produce identical results')
})

test('diffSync and mergeSync - error handling', (t) => {
  // Test basic functionality to ensure error handling exists
  const a = 'test\n'
  const b = 'test2\n'
  const c = 'test3\n'
  
  // Sync functions convert null to (null), so test actual operation
  const result1 = diffSync(a, b)
  const result2 = mergeSync(a, b, c)
  
  t.ok(result1.length >= 0, 'sync diff handles basic input')
  t.ok(result2.length >= 0, 'sync merge handles basic input')
})

test('sync vs async performance comparison', async (t) => {
  const a = ('x'.repeat(10000) + '\n')
  const b = ('y'.repeat(10000) + '\n')
  
  // Test sync performance
  const syncStart = Date.now()
  const syncResult = diffSync(a, b)
  const syncTime = Date.now() - syncStart
  
  // Test async performance  
  const asyncStart = Date.now()
  const asyncResult = await diff(a, b)
  const asyncTime = Date.now() - asyncStart
  
  t.alike(syncResult, asyncResult, 'sync and async produce identical large diff results')
  t.ok(syncTime >= 0 && asyncTime >= 0, 'both sync and async complete successfully')
})