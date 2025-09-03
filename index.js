const binding = require('./binding')

/**
 * Generates a patch from two buffers.
 * @param {Buffer | ArrayBuffer} a - The original buffer.
 * @param {Buffer | ArrayBuffer} b - The modified buffer.
 * @param {Object} [options] - Diff options.
 * @param {boolean} [options.ignoreWhitespace] - Ignore whitespace differences.
 * @param {boolean} [options.ignoreWhitespaceChange] - Ignore changes in whitespace.
 * @param {boolean} [options.ignoreWhitespaceAtEol] - Ignore whitespace at end of line.
 * @param {boolean} [options.ignoreBlankLines] - Ignore blank line changes.
 * @param {'minimal'|'patience'|'histogram'} [options.algorithm] - Diff algorithm to use.
 * @returns {Promise<Buffer>} A Promise that resolves with a buffer containing the patch.
 */
async function diff(a, b, options = {}) {
  if (!Buffer.isBuffer(a)) a = Buffer.from(a)
  if (!Buffer.isBuffer(b)) b = Buffer.from(b)
  
  return new Promise((resolve, reject) => {
    binding.diff(a, b, options, (err, result) => {
      if (err) reject(err)
      else resolve(Buffer.from(result))
    })
  })
}


/**
 * Merges two buffers based on an original buffer.
 * @param {Buffer | ArrayBuffer} o - The original buffer.
 * @param {Buffer | ArrayBuffer} a - The first modified buffer.
 * @param {Buffer | ArrayBuffer} b - The second modified buffer.
 * @param {Object} [options] - Merge options.
 * @param {'minimal'|'eager'|'zealous'|'zealous_alnum'} [options.level] - Merge simplification level.
 * @param {'ours'|'theirs'|'union'} [options.favor] - Conflict resolution preference.
 * @param {'normal'|'diff3'|'zealous_diff3'} [options.style] - Merge output style.
 * @param {number} [options.markerSize] - Conflict marker size (default: 7).
 * @returns {Promise<Buffer>} A Promise that resolves with the merged buffer.
 */
async function merge(o, a, b, options = {}) {
  if (!Buffer.isBuffer(o)) o = Buffer.from(o)
  if (!Buffer.isBuffer(a)) a = Buffer.from(a)
  if (!Buffer.isBuffer(b)) b = Buffer.from(b)
  
  return new Promise((resolve, reject) => {
    binding.merge(o, a, b, options, (err, result) => {
      if (err) reject(err)
      else resolve(Buffer.from(result))
    })
  })
}

/**
 * Generates a patch from two buffers (synchronous version).
 * @param {Buffer | ArrayBuffer} a - The original buffer.
 * @param {Buffer | ArrayBuffer} b - The modified buffer.
 * @param {Object} [options] - Diff options.
 * @param {boolean} [options.ignoreWhitespace] - Ignore whitespace differences.
 * @param {boolean} [options.ignoreWhitespaceChange] - Ignore changes in whitespace.
 * @param {boolean} [options.ignoreWhitespaceAtEol] - Ignore whitespace at end of line.
 * @param {boolean} [options.ignoreBlankLines] - Ignore blank line changes.
 * @param {'minimal'|'patience'|'histogram'} [options.algorithm] - Diff algorithm to use.
 * @returns {Buffer} A buffer containing the patch.
 */
function diffSync(a, b, options = {}) {
  if (!Buffer.isBuffer(a)) a = Buffer.from(a)
  if (!Buffer.isBuffer(b)) b = Buffer.from(b)
  
  const result = binding.diffSync(a, b, options)
  return Buffer.from(result)
}

/**
 * Merges two buffers based on an original buffer (synchronous version).
 * @param {Buffer | ArrayBuffer} o - The original buffer.
 * @param {Buffer | ArrayBuffer} a - The first modified buffer.
 * @param {Buffer | ArrayBuffer} b - The second modified buffer.
 * @param {Object} [options] - Merge options.
 * @param {'minimal'|'eager'|'zealous'|'zealous_alnum'} [options.level] - Merge simplification level.
 * @param {'ours'|'theirs'|'union'} [options.favor] - Conflict resolution preference.
 * @param {'normal'|'diff3'|'zealous_diff3'} [options.style] - Merge output style.
 * @param {number} [options.markerSize] - Conflict marker size (default: 7).
 * @returns {Buffer} The merged buffer.
 */
function mergeSync(o, a, b, options = {}) {
  if (!Buffer.isBuffer(o)) o = Buffer.from(o)
  if (!Buffer.isBuffer(a)) a = Buffer.from(a)
  if (!Buffer.isBuffer(b)) b = Buffer.from(b)
  
  const result = binding.mergeSync(o, a, b, options)
  return Buffer.from(result)
}

module.exports = {
  diff,
  merge,
  diffSync,
  mergeSync
}