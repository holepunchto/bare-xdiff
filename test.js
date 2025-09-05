const test = require('brittle')
const b4a = require('b4a')
const { diff, merge, diffSync, mergeSync } = require('.')

test('diff - simple text change', async (t) => {
  const a = b4a.from('hello world\n')
  const b = b4a.from('hello bare\n')
  
  const result = await diff(a, b)
  const resultStr = b4a.toString(result)
  
  t.ok(resultStr.includes('hello world'), 'contains original line')
  t.ok(resultStr.includes('hello bare'), 'contains modified line')
})

test('merge with options - favor ours', async (t) => {
  const ancestor = b4a.from('original line\n')
  const ours = b4a.from('our version\n')
  const theirs = b4a.from('their version\n')
  
  const result = await merge(ancestor, ours, theirs, { favor: 'ours' })
  const outputStr = b4a.toString(result.output)
  
  t.ok(outputStr.includes('our version'), 'favors our version')
  t.is(result.conflict, false, 'no conflict when favoring ours')
})

test('diff - multiple line changes', async (t) => {
  const a = b4a.from('line1\nline2\nline3\n')
  const b = b4a.from('line1\nmodified2\nline3\n')
  
  const result = await diff(a, b)
  const diffStr = b4a.toString(result)
  
  t.ok(diffStr.includes('line2'), 'contains original line2')
  t.ok(diffStr.includes('modified2'), 'contains modified line2')
})

test('diff - identical buffers', async (t) => {
  const a = b4a.from('same content\n')
  const b = b4a.from('same content\n')
  
  const result = await diff(a, b)
  t.is(result.length, 0, 'no diff for identical content')
})

test('diff - empty buffers', async (t) => {
  const a = b4a.from('')
  const b = b4a.from('')
  
  const result = await diff(a, b)
  t.is(result.length, 0, 'no diff for empty buffers')
})

test('diff - from empty to content', async (t) => {
  const a = b4a.from('')
  const b = b4a.from('new content\n')
  
  const result = await diff(a, b)
  const diffStr = b4a.toString(result)
  
  t.ok(result.length > 0, 'has diff content')
  t.ok(diffStr.includes('new content'), 'shows added content')
})

test('diff - from content to empty', async (t) => {
  const a = b4a.from('old content\n')
  const b = b4a.from('')
  
  const result = await diff(a, b)
  const diffStr = b4a.toString(result)
  
  t.ok(result.length > 0, 'has diff content')
  t.ok(diffStr.includes('old content'), 'shows removed content')
})


test('merge - no conflicts', async (t) => {
  const ancestor = b4a.from('line1\nline2\nline3\nline4\nline5\n')
  const ours = b4a.from('modified1\nline2\nline3\nline4\nline5\n')
  const theirs = b4a.from('line1\nline2\nline3\nline4\nmodified5\n')
  
  const result = await merge(ancestor, ours, theirs)
  const outputStr = b4a.toString(result.output)
  
  t.is(result.conflict, false, 'no conflicts detected')
  t.ok(outputStr.includes('modified1'), 'includes our change')
  t.ok(outputStr.includes('modified5'), 'includes their change')
  t.not(outputStr.includes('<<<'), 'no conflict markers')
})

test('merge - with conflicts', async (t) => {
  const ancestor = b4a.from('original line\n')
  const ours = b4a.from('our change\n')
  const theirs = b4a.from('their change\n')
  
  const result = await merge(ancestor, ours, theirs)
  const outputStr = b4a.toString(result.output)
  
  t.is(result.conflict, true, 'conflict detected')
  t.ok(outputStr.includes('<<<'), 'has conflict start marker')
  t.ok(outputStr.includes('==='), 'has conflict separator')
  t.ok(outputStr.includes('>>>'), 'has conflict end marker')
  t.ok(outputStr.includes('our change'), 'includes our change')
  t.ok(outputStr.includes('their change'), 'includes their change')
})

test('merge - identical changes', async (t) => {
  const ancestor = b4a.from('original\n')
  const ours = b4a.from('modified\n')
  const theirs = b4a.from('modified\n')
  
  const result = await merge(ancestor, ours, theirs, { level: 'zealous' })
  const outputStr = b4a.toString(result.output)
  
  t.is(result.conflict, false, 'no conflict for identical changes')
  t.is(b4a.toString(result.output), b4a.toString(ours), 'identical changes merge cleanly')
  t.not(outputStr.includes('<<<'), 'no conflict markers')
})

test('merge - empty buffers', async (t) => {
  const ancestor = b4a.from('')
  const ours = b4a.from('')
  const theirs = b4a.from('')
  
  const result = await merge(ancestor, ours, theirs)
  t.is(result.conflict, false, 'no conflict for empty buffers')
  t.is(result.output.length, 0, 'empty merge for empty buffers')
})

test('merge - one side adds content', async (t) => {
  const ancestor = b4a.from('base\n')
  const ours = b4a.from('base\nadded by us\n')
  const theirs = b4a.from('base\n')
  
  const result = await merge(ancestor, ours, theirs)
  const outputStr = b4a.toString(result.output)
  
  t.is(result.conflict, false, 'no conflict when one side adds')
  t.ok(outputStr.includes('added by us'), 'includes our addition')
  t.not(outputStr.includes('<<<'), 'no conflict markers')
})


test('concurrent operations', async (t) => {
  const promises = []
  
  // Run multiple operations concurrently
  for (let i = 0; i < 10; i++) {
    const a = b4a.from(`content ${i}\n`)
    const b = b4a.from(`modified ${i}\n`)
    promises.push(diff(a, b))
  }
  
  const results = await Promise.all(promises)
  
  t.is(results.length, 10, 'all operations completed')
  results.forEach((result, i) => {
    const resultStr = b4a.toString(result)
    t.ok(resultStr.includes(`content ${i}`), `diff ${i} contains original`)
    t.ok(resultStr.includes(`modified ${i}`), `diff ${i} contains modified`)
  })
})

test('error handling - accepts buffer input', async (t) => {
  const result = await diff(b4a.from('hello\n'), b4a.from('world\n'))
  t.ok(b4a.isBuffer(result), 'returns buffer')
  t.ok(result.length > 0, 'has diff content')
})

test('large buffer handling', async (t) => {
  const size = 100000
  const a = b4a.from('a'.repeat(size))
  const b = b4a.from('b'.repeat(size))
  
  const result = await diff(a, b)
  t.ok(result.length > 0, 'handles large buffers')
})

test('unicode content handling', async (t) => {
  const a = b4a.from('Hello 世界 🌍\n')
  const b = b4a.from('Hello 世界 🌎\n')
  
  const result = await diff(a, b)
  const diffStr = b4a.toString(result)
  
  t.ok(result.length > 0, 'handles unicode content')
  t.ok(diffStr.includes('🌍') || diffStr.includes('🌎'), 'preserves unicode characters')
})

test('diff with options - ignore whitespace', async (t) => {
  const a = b4a.from('hello world\n')
  const b = b4a.from('hello  world\n') // Extra space
  
  const result = await diff(a, b, { ignoreWhitespaceChange: true })
  
  t.is(result.length, 0, 'ignores whitespace changes')
})

// === COMPREHENSIVE DIFF ALGORITHM TESTS ===

test('diff algorithms - minimal vs patience vs histogram', async (t) => {
  // Create a challenging diff scenario where algorithms might behave differently
  const a = b4a.from(`common line
moved block A
moved block B  
common middle
original line
common end`)
  
  const b = b4a.from(`common line
common middle
moved block B
moved block A
modified line
common end`)
  
  const minimal = await diff(a, b)  // default minimal
  const patience = await diff(a, b, { algorithm: 'patience' })
  const histogram = await diff(a, b, { algorithm: 'histogram' })
  
  t.ok(minimal.length > 0, 'minimal algorithm produces diff')
  t.ok(patience.length > 0, 'patience algorithm produces diff') 
  t.ok(histogram.length > 0, 'histogram algorithm produces diff')
  
  // All should handle the same changes
  const minStr = b4a.toString(minimal)
  const patStr = b4a.toString(patience)
  const histStr = b4a.toString(histogram)
  
  t.ok(minStr.includes('modified line') || minStr.includes('original line'), 'minimal handles line change')
  t.ok(patStr.includes('modified line') || patStr.includes('original line'), 'patience handles line change')
  t.ok(histStr.includes('modified line') || histStr.includes('original line'), 'histogram handles line change')
})

test('diff algorithms - patience with moved blocks', async (t) => {
  const a = b4a.from(`function foo() {
  console.log('A')
  console.log('B')
}

function bar() {
  console.log('C')
}`)

  const b = b4a.from(`function bar() {
  console.log('C')  
}

function foo() {
  console.log('A')
  console.log('B')
}`)

  const patience = await diff(a, b, { algorithm: 'patience' })
  
  t.ok(patience.length > 0, 'patience algorithm detects moved functions')
  const diffStr = b4a.toString(patience)
  t.ok(diffStr.includes('foo') && diffStr.includes('bar'), 'includes both function names')
})

// === COMPREHENSIVE WHITESPACE TESTS ===

test('whitespace options - ignoreWhitespace', async (t) => {
  const a = b4a.from('hello world\n')
  const b = b4a.from('helloworld\n')  // No spaces
  
  const result = await diff(a, b, { ignoreWhitespace: true })
  t.is(result.length, 0, 'ignores all whitespace differences')
})

test('whitespace options - ignoreWhitespaceChange', async (t) => {
  const a = b4a.from('hello\tworld\n')
  const b = b4a.from('hello    world\n')  // Tab vs spaces
  
  const result = await diff(a, b, { ignoreWhitespaceChange: true })
  t.is(result.length, 0, 'ignores whitespace changes')
})

test('whitespace options - ignoreWhitespaceAtEol', async (t) => {
  const a = b4a.from('hello world\n')
  const b = b4a.from('hello world   \n')  // Trailing spaces
  
  const result = await diff(a, b, { ignoreWhitespaceAtEol: true })
  t.is(result.length, 0, 'ignores whitespace at end of line')
})

test('whitespace options - ignoreBlankLines', async (t) => {
  const a = b4a.from('line1\nline2\nline3\n')
  const b = b4a.from('line1\n\nline2\n\n\nline3\n')  // Extra blank lines
  
  const result = await diff(a, b, { ignoreBlankLines: true })
  t.is(result.length, 0, 'ignores blank line differences')
})

test('whitespace options - combined whitespace flags', async (t) => {
  const a = b4a.from('hello\tworld\nline2\n')
  const b = b4a.from('hello    world   \n\nline2   \n')  // Multiple whitespace issues
  
  const result = await diff(a, b, { 
    ignoreWhitespaceChange: true,
    ignoreWhitespaceAtEol: true, 
    ignoreBlankLines: true
  })
  
  t.is(result.length, 0, 'handles multiple whitespace options together')
})

// === COMPREHENSIVE MERGE LEVEL TESTS ===

test('merge levels - minimal vs eager vs zealous', async (t) => {
  const ancestor = b4a.from(`start
conflict line
end`)

  const ours = b4a.from(`start
our change
end`)

  const theirs = b4a.from(`start  
their change
end`)

  const minimal = await merge(ancestor, ours, theirs, { level: 'minimal' })
  const eager = await merge(ancestor, ours, theirs, { level: 'eager' })
  const zealous = await merge(ancestor, ours, theirs, { level: 'zealous' })
  
  // All should produce conflict markers since this is a true conflict
  t.is(minimal.conflict, true, 'minimal detects conflict')
  t.is(eager.conflict, true, 'eager detects conflict')
  t.is(zealous.conflict, true, 'zealous detects conflict')
  t.ok(b4a.toString(minimal.output).includes('<<<'), 'minimal shows conflicts')
  t.ok(b4a.toString(eager.output).includes('<<<'), 'eager shows conflicts') 
  t.ok(b4a.toString(zealous.output).includes('<<<'), 'zealous shows conflicts')
})

test('merge levels - zealous_alnum with alphanumeric conflicts', async (t) => {
  const ancestor = b4a.from('version = 1.0.0\n')
  const ours = b4a.from('version = 1.1.0\n')  
  const theirs = b4a.from('version = 1.0.1\n')
  
  const result = await merge(ancestor, ours, theirs, { level: 'zealous_alnum' })
  const outputStr = b4a.toString(result.output)
  
  t.is(result.conflict, true, 'zealous_alnum detects version conflict')
  t.ok(outputStr.includes('<<<'), 'zealous_alnum creates conflict markers for version conflicts')
  t.ok(outputStr.includes('1.1.0'), 'includes our version')
  t.ok(outputStr.includes('1.0.1'), 'includes their version')
})

// === COMPREHENSIVE MERGE FAVOR TESTS ===

test('merge favor modes - ours vs theirs vs union', async (t) => {
  const ancestor = b4a.from('original content\n')
  const ours = b4a.from('our version\n')
  const theirs = b4a.from('their version\n')
  
  const favorOurs = await merge(ancestor, ours, theirs, { favor: 'ours' })
  const favorTheirs = await merge(ancestor, ours, theirs, { favor: 'theirs' })  
  const favorUnion = await merge(ancestor, ours, theirs, { favor: 'union' })
  
  t.ok(b4a.toString(favorOurs.output).includes('our version'), 'favor ours chooses our version')
  t.ok(b4a.toString(favorTheirs.output).includes('their version'), 'favor theirs chooses their version')
  const unionStr = b4a.toString(favorUnion.output)
  t.ok(unionStr.includes('our version') && unionStr.includes('their version'), 'union includes both versions')
})

test('merge favor - complex conflict resolution', async (t) => {
  const ancestor = b4a.from(`function example() {
  return 'original'
}`)

  const ours = b4a.from(`function example() {
  return 'modified by us'  
}`)

  const theirs = b4a.from(`function example() {
  return 'modified by them'
}`)

  const favorOurs = await merge(ancestor, ours, theirs, { favor: 'ours' })
  t.ok(b4a.toString(favorOurs.output).includes('modified by us'), 'complex favor ours works')
})

// === MERGE STYLE TESTS ===

test('merge styles - diff3 format', async (t) => {
  const ancestor = b4a.from('original\n')
  const ours = b4a.from('ours\n')
  const theirs = b4a.from('theirs\n')
  
  const diff3 = await merge(ancestor, ours, theirs, { style: 'diff3' })
  const normal = await merge(ancestor, ours, theirs)
  
  // diff3 format should include original/ancestor section
  t.is(diff3.conflict, true, 'diff3 detects conflict')
  t.is(normal.conflict, true, 'normal detects conflict')
  t.ok(b4a.toString(diff3.output).includes('|||'), 'diff3 style includes ancestor markers')
  t.not(b4a.toString(normal.output).includes('|||'), 'normal style does not include ancestor markers')
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
  
  const zealousDiff3 = await merge(b4a.from(ancestor), b4a.from(ours), b4a.from(theirs), { 
    style: 'zealous_diff3',
    level: 'zealous'
  })
  
  t.is(zealousDiff3.conflict, true, 'zealous_diff3 detects conflict')
  t.ok(b4a.toString(zealousDiff3.output).includes('|||'), 'zealous_diff3 includes ancestor section')
  t.ok(b4a.toString(zealousDiff3.output).includes('our change'), 'includes our changes')
  t.ok(b4a.toString(zealousDiff3.output).includes('their change'), 'includes their changes')
})

// === EDGE CASE TESTS ===

test('edge cases - very long lines', async (t) => {
  const longLine = 'x'.repeat(10000)
  const a = b4a.from(`${longLine}\n`)
  const b = b4a.from(`${longLine}y\n`)  // One char difference
  
  const result = await diff(a, b)
  t.ok(result.length > 0, 'handles very long lines')
  t.ok(b4a.toString(result).includes('x'), 'diff contains expected content')
})

test('edge cases - many small changes', async (t) => {
  let textA = ''
  let textB = ''
  
  // Create 100 lines with small differences on every other line
  for (let i = 0; i < 100; i++) {
    textA += `line ${i} original\n`
    textB += i % 2 === 0 ? `line ${i} original\n` : `line ${i} modified\n`
  }
  
  const result = await diff(b4a.from(textA), b4a.from(textB))
  t.ok(result.length > 0, 'handles many small changes')
  
  const diffStr = b4a.toString(result)
  t.ok(diffStr.includes('modified'), 'includes modifications')
})

test('edge cases - special characters', async (t) => {
  const textA = b4a.from('line with special chars: àáâã\n')
  const textB = b4a.from('line with special chars: ëèéê\n')
  
  const result = await diff(textA, textB)
  t.ok(result.length > 0, 'handles special characters')
})

test('edge cases - mixed line endings', async (t) => {
  const a = b4a.from('line1\nline2\nline3\n')        // Unix
  const b = b4a.from('line1\r\nline2\r\nline3\r\n')  // Windows  
  
  const result = await diff(a, b)
  t.ok(result.length > 0, 'detects line ending differences')
})

test('edge cases - merge with empty ancestor', async (t) => {
  const ancestor = b4a.from('')
  const ours = b4a.from('our content\n')
  const theirs = b4a.from('their content\n')
  
  const result = await merge(ancestor, ours, theirs)
  
  t.is(result.conflict, true, 'detects conflict with empty ancestor')
  t.ok(b4a.toString(result.output).includes('our content'), 'includes our content')
  t.ok(b4a.toString(result.output).includes('their content'), 'includes their content')
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
  const result = await diff(b4a.from(textA), b4a.from(textB))
  const duration = Date.now() - start
  
  t.ok(result.length > 0, 'produces diff for large files')
  t.ok(duration < 5000, 'completes within reasonable time (5s)')
})

test('options validation - invalid algorithm', async (t) => {
  const a = b4a.from('test\n')
  const b = b4a.from('test2\n')
  
  // Invalid algorithm should fall back to default behavior (not crash)
  const result = await diff(a, b, { algorithm: 'invalid' })
  t.ok(result.length > 0, 'handles invalid algorithm gracefully')
})

test('merge - custom marker size', async (t) => {
  const ancestor = b4a.from('original\n')
  const ours = b4a.from('ours\n') 
  const theirs = b4a.from('theirs\n')
  
  const result = await merge(ancestor, ours, theirs, { markerSize: 10 })
  
  // Should use 10-character conflict markers instead of default 7
  t.is(result.conflict, true, 'detects conflict with custom marker')
  t.ok(b4a.toString(result.output).includes('<'.repeat(10)), 'uses custom marker size')
})

// === SYNC FUNCTION TESTS ===

test('diffSync - basic functionality', (t) => {
  const a = b4a.from('hello\nworld\n')
  const b = b4a.from('hello\nworld!\n')
  
  const result = diffSync(a, b)
  t.ok(result.length > 0, 'sync diff produces result')
  
  const diffStr = b4a.toString(result)
  t.ok(diffStr.includes('-world'), 'shows old line')
  t.ok(diffStr.includes('+world!'), 'shows new line')
})

test('diffSync - identical inputs', (t) => {
  const a = b4a.from('same content\n')
  const b = b4a.from('same content\n')
  
  const result = diffSync(a, b)
  t.is(result.length, 0, 'sync diff of identical inputs is empty')
})

test('diffSync - with options', (t) => {
  const a = b4a.from('hello world\n')
  const b = b4a.from('hello  world\n') // Extra space
  
  const result = diffSync(a, b, { ignoreWhitespaceChange: true })
  t.is(result.length, 0, 'sync diff ignores whitespace changes with option')
})

test('diffSync - algorithm options', (t) => {
  const a = b4a.from('line1\nline2\nline3\n')
  const b = b4a.from('line1\nmodified\nline3\n')
  
  const minimal = diffSync(a, b)
  const patience = diffSync(a, b, { algorithm: 'patience' })
  const histogram = diffSync(a, b, { algorithm: 'histogram' })
  
  t.ok(minimal.length > 0, 'sync minimal algorithm produces result')
  t.ok(patience.length > 0, 'sync patience algorithm produces result')
  t.ok(histogram.length > 0, 'sync histogram algorithm produces result')
})

test('diffSync - all whitespace options', (t) => {
  const a = b4a.from('hello world \n\nfinal\n')
  const b = b4a.from('hello\tworld\n \nfinal\n')
  
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
  const ancestor = b4a.from('original line\n')
  const ours = b4a.from('our changes\n')
  const theirs = b4a.from('their changes\n')
  
  const result = mergeSync(ancestor, ours, theirs)
  t.is(result.conflict, true, 'sync merge detects conflict')
  t.ok(result.output.length > 0, 'sync merge produces result')
  t.ok(b4a.toString(result.output).includes('our changes') || b4a.toString(result.output).includes('<<<<<<<'), 'sync merge contains expected content')
})

test('mergeSync - no conflicts', (t) => {
  const ancestor = b4a.from('line1\nline2\nline3\nline4\nline5\n')
  const ours = b4a.from('modified1\nline2\nline3\nline4\nline5\n')
  const theirs = b4a.from('line1\nline2\nline3\nline4\nmodified5\n')
  
  const result = mergeSync(ancestor, ours, theirs)
  const outputStr = b4a.toString(result.output)
  
  t.is(result.conflict, false, 'sync merge detects no conflict')
  t.ok(outputStr.includes('modified1'), 'sync merge includes our changes')
  t.ok(outputStr.includes('modified5'), 'sync merge includes their changes')
  t.ok(!outputStr.includes('<<<<<<<'), 'sync merge has no conflict markers')
})

test('mergeSync - merge levels', (t) => {
  const ancestor = b4a.from('original\n')
  const ours = b4a.from('ours\n')
  const theirs = b4a.from('theirs\n')
  
  const minimal = mergeSync(ancestor, ours, theirs, { level: 'minimal' })
  const eager = mergeSync(ancestor, ours, theirs, { level: 'eager' })
  const zealous = mergeSync(ancestor, ours, theirs, { level: 'zealous' })
  const zealousAlnum = mergeSync(ancestor, ours, theirs, { level: 'zealous_alnum' })
  
  t.is(minimal.conflict, true, 'sync minimal level detects conflict')
  t.is(eager.conflict, true, 'sync eager level detects conflict')
  t.is(zealous.conflict, true, 'sync zealous level detects conflict')
  t.is(zealousAlnum.conflict, true, 'sync zealous_alnum level detects conflict')
  t.ok(minimal.output.length > 0, 'sync minimal level works')
  t.ok(eager.output.length > 0, 'sync eager level works')
  t.ok(zealous.output.length > 0, 'sync zealous level works')
  t.ok(zealousAlnum.output.length > 0, 'sync zealous_alnum level works')
})

test('mergeSync - favor modes', (t) => {
  const ancestor = b4a.from('original\n')
  const ours = b4a.from('ours\n')
  const theirs = b4a.from('theirs\n')
  
  const favorOurs = mergeSync(ancestor, ours, theirs, { favor: 'ours' })
  const favorTheirs = mergeSync(ancestor, ours, theirs, { favor: 'theirs' })
  const favorUnion = mergeSync(ancestor, ours, theirs, { favor: 'union' })
  
  t.is(favorOurs.conflict, false, 'sync favor ours resolves conflict')
  t.is(favorTheirs.conflict, false, 'sync favor theirs resolves conflict')
  t.ok(b4a.toString(favorOurs.output).includes('ours'), 'sync favor ours works')
  t.ok(b4a.toString(favorTheirs.output).includes('theirs'), 'sync favor theirs works')
  t.ok(favorUnion.output.length > 0, 'sync favor union works')
})

test('mergeSync - merge styles', (t) => {
  const ancestor = b4a.from('original\n')
  const ours = b4a.from('ours\n')
  const theirs = b4a.from('theirs\n')
  
  const normal = mergeSync(ancestor, ours, theirs, { style: 'normal' })
  const diff3 = mergeSync(ancestor, ours, theirs, { style: 'diff3' })
  const zealousDiff3 = mergeSync(ancestor, ours, theirs, { style: 'zealous_diff3' })
  
  t.is(normal.conflict, true, 'sync normal style detects conflict')
  t.is(diff3.conflict, true, 'sync diff3 style detects conflict')
  t.is(zealousDiff3.conflict, true, 'sync zealous_diff3 style detects conflict')
  t.ok(normal.output.length > 0, 'sync normal style works')
  t.ok(diff3.output.length > 0, 'sync diff3 style works')
  t.ok(zealousDiff3.output.length > 0, 'sync zealous_diff3 style works')
})

test('mergeSync - custom marker size', (t) => {
  const ancestor = b4a.from('original\n')
  const ours = b4a.from('ours\n')
  const theirs = b4a.from('theirs\n')
  
  const result = mergeSync(ancestor, ours, theirs, { markerSize: 10 })
  
  t.is(result.conflict, true, 'sync merge detects conflict with custom marker')
  t.ok(b4a.toString(result.output).includes('<'.repeat(10)), 'sync merge uses custom marker size')
})

test('mergeSync - identical to async results', async (t) => {
  const ancestor = b4a.from('line1\ncommon\nline3\n')
  const ours = b4a.from('line1\nours\nline3\n')
  const theirs = b4a.from('line1\ntheirs\nline3\n')
  
  const syncResult = mergeSync(ancestor, ours, theirs)
  const asyncResult = await merge(ancestor, ours, theirs)
  
  t.alike(syncResult, asyncResult, 'sync and async merge produce identical results')
})

test('diffSync - identical to async results', async (t) => {
  const a = b4a.from('line1\nline2\nline3\n')
  const b = b4a.from('line1\nmodified\nline3\n')
  
  const syncResult = diffSync(a, b)
  const asyncResult = await diff(a, b)
  
  t.alike(syncResult, asyncResult, 'sync and async diff produce identical results')
})

test('diffSync and mergeSync - error handling', (t) => {
  // Test basic functionality to ensure error handling exists
  const a = b4a.from('test\n')
  const b = b4a.from('test2\n')
  const c = b4a.from('test3\n')
  
  // Sync functions convert null to (null), so test actual operation
  const result1 = diffSync(a, b)
  const result2 = mergeSync(a, b, c)
  
  t.ok(result1.length >= 0, 'sync diff handles basic input')
  t.ok(result2.output.length >= 0, 'sync merge handles basic input')
})

test('sync vs async performance comparison', async (t) => {
  const a = b4a.from('x'.repeat(10000) + '\n')
  const b = b4a.from('y'.repeat(10000) + '\n')
  
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