const { diff, merge, diffSync, mergeSync } = require('.')
const process = require('process')
const top = require('process-top')
const b4a = require('b4a')

// Generate random string data of specified size efficiently
function generateRandomData(sizeInBytes) {
  // Create efficient test data - repeating pattern to simulate realistic text
  const pattern = 'line content with some text and numbers 123\n'
  const patternBuffer = b4a.from(pattern)
  const numRepeats = Math.ceil(sizeInBytes / patternBuffer.length)
  
  // Create buffer by repeating pattern
  const fullBuffer = b4a.allocUnsafe(numRepeats * patternBuffer.length)
  for (let i = 0; i < numRepeats; i++) {
    patternBuffer.copy(fullBuffer, i * patternBuffer.length)
  }
  
  // Trim to exact size and return as buffer
  return fullBuffer.subarray(0, sizeInBytes)
}

// Generate modified version of data (change ~10% of lines)
function generateModifiedData(original) {
  const originalStr = b4a.toString(original)
  const lines = originalStr.split('\n')
  const modifiedLines = lines.map((line, index) => {
    // Modify approximately every 10th line
    if (index % 10 === 0 && line.length > 0) {
      return line + '_modified'
    }
    return line
  })
  return b4a.from(modifiedLines.join('\n'))
}

// Benchmark configuration
const sizes = [
  { name: '4KB', bytes: 4 * 1024 },
  { name: '64KB', bytes: 64 * 1024 },
  { name: '128KB', bytes: 128 * 1024 },
  { name: '1MB', bytes: 1024 * 1024 },
  { name: '16MB', bytes: 16 * 1024 * 1024 },
  { name: '32MB', bytes: 32 * 1024 * 1024 },
  { name: '64MB', bytes: 64 * 1024 * 1024 },
  { name: '128MB', bytes: 128 * 1024 * 1024 },
  { name: '256MB', bytes: 256 * 1024 * 1024 }
]

// Memory benchmark configuration
const memorySizes = [
  { name: '1MB', bytes: 1024 * 1024 },
  { name: '4MB', bytes: 4 * 1024 * 1024 },
  { name: '8MB', bytes: 8 * 1024 * 1024 },
  { name: '16MB', bytes: 16 * 1024 * 1024 },
  { name: '32MB', bytes: 32 * 1024 * 1024 },
  { name: '64MB', bytes: 64 * 1024 * 1024 },
  { name: '128MB', bytes: 128 * 1024 * 1024 },
  { name: '256MB', bytes: 256 * 1024 * 1024 }
]

async function benchmarkDiff(name, size, iterations = 5) {
  console.log(`\n=== Diff Benchmark: ${name} ===`)
  
  // Generate test data
  const original = generateRandomData(size)
  const modified = generateModifiedData(original)
  
  console.log(`Data size: ${(size / 1024).toFixed(1)}KB`)
  console.log(`Running ${iterations} iterations...`)
  
  // Benchmark async diff - run all iterations in parallel
  const asyncPromises = []
  const asyncTimes = []
  
  for (let i = 0; i < iterations; i++) {
    asyncPromises.push(diff(original, modified))
  }
  
  const batchStart = process.hrtime.bigint()
  const asyncResults = await Promise.all(asyncPromises)
  const batchEnd = process.hrtime.bigint()
  
  const totalBatchTime = Number(batchEnd - batchStart) / 1000000
  const avgTimePerOperation = totalBatchTime / iterations
  
  // Fill the times array with the average time
  for (let i = 0; i < iterations; i++) {
    asyncTimes.push(avgTimePerOperation)
  }
  
  console.log(`Diff output size: ${(asyncResults[0].length / 1024).toFixed(1)}KB`)
  
  // Benchmark sync diff
  const syncTimes = []
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint()
    const result = diffSync(original, modified)
    const end = process.hrtime.bigint()
    const timeMs = Number(end - start) / 1000000
    syncTimes.push(timeMs)
  }
  
  // Calculate statistics
  const asyncAvg = asyncTimes.reduce((a, b) => a + b, 0) / asyncTimes.length
  const syncAvg = syncTimes.reduce((a, b) => a + b, 0) / syncTimes.length
  const asyncMin = Math.min(...asyncTimes)
  const syncMin = Math.min(...syncTimes)
  
  console.log(`Async diff: ${asyncAvg.toFixed(2)}ms avg, ${asyncMin.toFixed(2)}ms min`)
  console.log(`Sync diff:  ${syncAvg.toFixed(2)}ms avg, ${syncMin.toFixed(2)}ms min`)
  
  return {
    size: name,
    bytes: size,
    asyncAvg,
    syncAvg,
    asyncMin,
    syncMin,
    diffOutputSize: 0 // Will be set by first iteration
  }
}

async function benchmarkMerge(name, size, iterations = 5) {
  console.log(`\n=== Merge Benchmark: ${name} ===`)
  
  // Generate test data for three-way merge
  const ancestor = generateRandomData(size)
  const ours = generateModifiedData(ancestor)
  const theirsStr = b4a.toString(generateModifiedData(ancestor)) + '_theirs'
  const theirs = b4a.from(theirsStr)
  
  console.log(`Data size: ${(size / 1024).toFixed(1)}KB`)
  console.log(`Running ${iterations} iterations...`)
  
  // Benchmark async merge - run all iterations in parallel
  const asyncPromises = []
  const asyncTimes = []
  
  for (let i = 0; i < iterations; i++) {
    asyncPromises.push(merge(ancestor, ours, theirs))
  }
  
  const batchStart = process.hrtime.bigint()
  const asyncResults = await Promise.all(asyncPromises)
  const batchEnd = process.hrtime.bigint()
  
  const totalBatchTime = Number(batchEnd - batchStart) / 1000000
  const avgTimePerOperation = totalBatchTime / iterations
  
  // Fill the times array with the average time
  for (let i = 0; i < iterations; i++) {
    asyncTimes.push(avgTimePerOperation)
  }
  
  console.log(`Merge output size: ${(asyncResults[0].output.length / 1024).toFixed(1)}KB`)
  
  // Benchmark sync merge
  const syncTimes = []
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint()
    const result = mergeSync(ancestor, ours, theirs)
    const end = process.hrtime.bigint()
    const timeMs = Number(end - start) / 1000000
    syncTimes.push(timeMs)
  }
  
  // Calculate statistics
  const asyncAvg = asyncTimes.reduce((a, b) => a + b, 0) / asyncTimes.length
  const syncAvg = syncTimes.reduce((a, b) => a + b, 0) / syncTimes.length
  const asyncMin = Math.min(...asyncTimes)
  const syncMin = Math.min(...syncTimes)
  
  console.log(`Async merge: ${asyncAvg.toFixed(2)}ms avg, ${asyncMin.toFixed(2)}ms min`)
  console.log(`Sync merge:  ${syncAvg.toFixed(2)}ms avg, ${syncMin.toFixed(2)}ms min`)
  
  return {
    size: name,
    bytes: size,
    asyncAvg,
    syncAvg,
    asyncMin,
    syncMin
  }
}

async function benchmarkAlgorithms(name, size) {
  console.log(`\n=== Algorithm Comparison: ${name} ===`)
  
  // Generate test data that benefits from different algorithms
  const lines = []
  const numLines = Math.floor(size / 50) // Approximate line count
  
  for (let i = 0; i < numLines; i++) {
    lines.push(`line_${i}_${Math.random().toString(36).substring(7)}`)
  }
  
  // Create moved block scenario
  const originalLines = [...lines]
  const modifiedLines = [...lines]
  
  // Move some blocks around to test algorithm differences
  if (modifiedLines.length > 20) {
    const block1 = modifiedLines.splice(10, 5)
    const block2 = modifiedLines.splice(15, 5)
    modifiedLines.splice(5, 0, ...block2)
    modifiedLines.splice(25, 0, ...block1)
  }
  
  const textA = b4a.from(originalLines.join('\n'))
  const textB = b4a.from(modifiedLines.join('\n'))
  
  console.log(`Data size: ${(size / 1024).toFixed(1)}KB`)
  
  const algorithms = ['minimal', 'patience', 'histogram']
  const results = {}
  
  for (const algorithm of algorithms) {
    const times = []
    
    for (let i = 0; i < 3; i++) {
      const start = process.hrtime.bigint()
      const result = await diff(textA, textB, { algorithm })
      const end = process.hrtime.bigint()
      const timeMs = Number(end - start) / 1000000
      times.push(timeMs)
      
      if (i === 0) {
        results[algorithm] = {
          time: timeMs,
          outputSize: result.length
        }
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length
    console.log(`${algorithm}: ${avgTime.toFixed(2)}ms avg, output: ${(results[algorithm].outputSize / 1024).toFixed(1)}KB`)
  }
  
  return results
}

async function benchmarkMemoryUsage() {
  console.log('\n=== Memory Usage Analysis ===')
  
  const memoryResults = []
  
  for (const { name, bytes } of memorySizes) {
    try {
      console.log(`\nTesting ${name} (${(bytes / 1024 / 1024).toFixed(1)}MB)...`)
      
      // Get baseline memory
      global.gc && global.gc()
      await new Promise(resolve => setTimeout(resolve, 100)) // Let GC settle
      const baseline = top().memory()
      
      // Generate test data
      const original = generateRandomData(bytes)
      const modified = generateModifiedData(original)
      
      // Memory after data generation
      const afterData = top().memory()
      const dataMemory = afterData.rss - baseline.rss
      
      console.log(`  Data generation: +${(dataMemory / 1024 / 1024).toFixed(1)}MB`)
      
      // Test diff operation
      const beforeDiff = top().memory()
      const diffResult = await diff(original, modified)
      const afterDiff = top().memory()
      const diffMemory = afterDiff.rss - beforeDiff.rss
      
      console.log(`  Diff operation: +${(diffMemory / 1024 / 1024).toFixed(1)}MB, output: ${(diffResult.length / 1024 / 1024).toFixed(1)}MB`)
      
      // Test merge operation  
      const beforeMerge = top().memory()
      const mergeResult = await merge(original, original, modified)
      const afterMerge = top().memory()
      const mergeMemory = afterMerge.rss - beforeMerge.rss
      
      console.log(`  Merge operation: +${(mergeMemory / 1024 / 1024).toFixed(1)}MB, output: ${(mergeResult.output.length / 1024 / 1024).toFixed(1)}MB`)
      
      // Peak memory usage
      const peak = top().memory()
      const peakMemory = peak.rss - baseline.rss
      console.log(`  Peak memory usage: +${(peakMemory / 1024 / 1024).toFixed(1)}MB`)
      
      memoryResults.push({
        size: name,
        inputSize: bytes / 1024 / 1024,
        dataMemory: Math.max(0, dataMemory) / 1024 / 1024,
        diffMemory: Math.max(0, diffMemory) / 1024 / 1024,
        mergeMemory: Math.max(0, mergeMemory) / 1024 / 1024,
        peakMemory: Math.max(0, peakMemory) / 1024 / 1024,
        diffOutputSize: diffResult.length / 1024 / 1024,
        mergeOutputSize: mergeResult.output.length / 1024 / 1024
      })
      
      // Cleanup
      global.gc && global.gc()
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (error) {
      console.error(`  ❌ Error testing ${name}: ${error.message}`)
      break // Stop on OOM or other errors
    }
  }
  
  return memoryResults
}

async function runAllBenchmarks() {
  console.log('🚀 bare-xdiff Performance Benchmark Suite')
  console.log('==========================================')
  
  const diffResults = []
  const mergeResults = []
  
  for (const { name, bytes } of sizes) {
    try {
      const iterations = 5
      
      const diffResult = await benchmarkDiff(name, bytes, iterations)
      diffResults.push(diffResult)
      
      const mergeResult = await benchmarkMerge(name, bytes, iterations)
      mergeResults.push(mergeResult)
      
      // Algorithm comparison for smaller files
      if (bytes <= 1024 * 1024) {
        await benchmarkAlgorithms(name, bytes)
      }
      
    } catch (error) {
      console.error(`❌ Error benchmarking ${name}:`, error.message)
    }
  }
  
  // Run memory usage analysis
  const memoryResults = await benchmarkMemoryUsage()
  
  // Consolidated summary at the end
  console.log('\n📊 COMPREHENSIVE BENCHMARK SUMMARY')
  console.log('==================================')
  
  console.log('\nPerformance Results:')
  console.log('Size      | Diff Async | Diff Sync | Merge Async | Merge Sync')
  console.log('----------|------------|-----------|-------------|------------')
  for (let i = 0; i < diffResults.length; i++) {
    const diffResult = diffResults[i]
    const mergeResult = mergeResults[i]
    console.log(
      `${diffResult.size.padEnd(9)} | ${diffResult.asyncAvg.toFixed(2).padStart(10)}ms | ${diffResult.syncAvg.toFixed(2).padStart(9)}ms | ${mergeResult.asyncAvg.toFixed(2).padStart(11)}ms | ${mergeResult.syncAvg.toFixed(2).padStart(10)}ms`
    )
  }
  
  console.log('\nThroughput Analysis (MB/s):')
  console.log('Size      | Diff Sync | Diff Async | Merge Sync | Merge Async')
  console.log('----------|-----------|------------|------------|------------')
  for (let i = 0; i < diffResults.length; i++) {
    const diffResult = diffResults[i]
    const mergeResult = mergeResults[i]
    const mbSize = diffResult.bytes / (1024 * 1024)
    
    const diffSyncThroughput = (mbSize / (diffResult.syncAvg / 1000)).toFixed(2)
    const diffAsyncThroughput = (mbSize / (diffResult.asyncAvg / 1000)).toFixed(2)
    const mergeSyncThroughput = (mbSize / (mergeResult.syncAvg / 1000)).toFixed(2)
    const mergeAsyncThroughput = (mbSize / (mergeResult.asyncAvg / 1000)).toFixed(2)
    
    console.log(
      `${diffResult.size.padEnd(9)} | ${diffSyncThroughput.padStart(9)} | ${diffAsyncThroughput.padStart(10)} | ${mergeSyncThroughput.padStart(10)} | ${mergeAsyncThroughput.padStart(11)}`
    )
  }
  
  // Memory usage summary
  if (memoryResults.length > 0) {
    console.log('\nMemory Usage Analysis:')
    console.log('Size | Input | Data  | Diff  | Merge | Peak  | Ratio')
    console.log('-----|-------|-------|-------|-------|-------|------')
    
    for (const result of memoryResults) {
      const ratio = (result.peakMemory / result.inputSize).toFixed(1)
      console.log(
        `${result.size.padEnd(4)} | ${result.inputSize.toFixed(1).padStart(5)} | ${result.dataMemory.toFixed(1).padStart(5)} | ${result.diffMemory.toFixed(1).padStart(5)} | ${result.mergeMemory.toFixed(1).padStart(5)} | ${result.peakMemory.toFixed(1).padStart(5)} | ${ratio}x`
      )
    }
  }
  
  console.log('\n✅ Benchmark complete!')
}

// Run benchmarks
if (require.main === module) {
  console.log(`Platform: ${process.platform} ${process.arch}\n`)
  
  runAllBenchmarks().catch(console.error)
}

module.exports = {
  benchmarkDiff,
  benchmarkMerge,
  benchmarkAlgorithms,
  benchmarkMemoryUsage,
  generateRandomData,
  generateModifiedData
}