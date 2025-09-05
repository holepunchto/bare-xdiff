const binding = require('./binding')
const b4a = require('b4a')

/**
 * Generates a patch from two buffers.
 * @param {Uint8Array} a - The original data.
 * @param {Uint8Array} b - The modified data.
 * @param {Object} [options] - Diff options.
 * @param {boolean} [options.ignoreWhitespace] - Ignore whitespace differences.
 * @param {boolean} [options.ignoreWhitespaceChange] - Ignore changes in whitespace.
 * @param {boolean} [options.ignoreWhitespaceAtEol] - Ignore whitespace at end of line.
 * @param {boolean} [options.ignoreBlankLines] - Ignore blank line changes.
 * @param {'minimal'|'patience'|'histogram'} [options.algorithm] - Diff algorithm to use.
 * @returns {Promise<Uint8Array>} A Promise that resolves with a Uint8Array containing the patch.
 */
async function diff(a, b, options = {}) {
  if (!b4a.isBuffer(a) || !b4a.isBuffer(b)) {
    throw new Error('diff() requires Uint8Array inputs')
  }
  return new Promise((resolve, reject) => {
    binding.diff(a, b, options, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}


/**
 * Merges two buffers based on an original buffer.
 * @param {Uint8Array} o - The original data.
 * @param {Uint8Array} a - The first modified data.
 * @param {Uint8Array} b - The second modified data.
 * @param {Object} [options] - Merge options.
 * @param {'minimal'|'eager'|'zealous'|'zealous_alnum'} [options.level] - Merge simplification level.
 * @param {'ours'|'theirs'|'union'} [options.favor] - Conflict resolution preference.
 * @param {'normal'|'diff3'|'zealous_diff3'} [options.style] - Merge output style.
 * @param {number} [options.markerSize] - Conflict marker size (default: 7).
 * @returns {Promise<{conflict: boolean, output: Uint8Array}>} A Promise that resolves with an object containing conflict status and merged data.
 */
async function merge(o, a, b, options = {}) {
  if (!b4a.isBuffer(o) || !b4a.isBuffer(a) || !b4a.isBuffer(b)) {
    throw new Error('merge() requires Uint8Array inputs')
  }
  return new Promise((resolve, reject) => {
    binding.merge(o, a, b, options, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

/**
 * Generates a patch from two buffers (synchronous version).
 * @param {Uint8Array} a - The original data.
 * @param {Uint8Array} b - The modified data.
 * @param {Object} [options] - Diff options.
 * @param {boolean} [options.ignoreWhitespace] - Ignore whitespace differences.
 * @param {boolean} [options.ignoreWhitespaceChange] - Ignore changes in whitespace.
 * @param {boolean} [options.ignoreWhitespaceAtEol] - Ignore whitespace at end of line.
 * @param {boolean} [options.ignoreBlankLines] - Ignore blank line changes.
 * @param {'minimal'|'patience'|'histogram'} [options.algorithm] - Diff algorithm to use.
 * @returns {Uint8Array} A Uint8Array containing the patch.
 */
function diffSync(a, b, options = {}) {
  if (!b4a.isBuffer(a) || !b4a.isBuffer(b)) {
    throw new Error('diffSync() requires Uint8Array inputs')
  }
  const result = binding.diffSync(a, b, options)
  return result
}

/**
 * Merges two buffers based on an original buffer (synchronous version).
 * @param {Uint8Array} o - The original data.
 * @param {Uint8Array} a - The first modified data.
 * @param {Uint8Array} b - The second modified data.
 * @param {Object} [options] - Merge options.
 * @param {'minimal'|'eager'|'zealous'|'zealous_alnum'} [options.level] - Merge simplification level.
 * @param {'ours'|'theirs'|'union'} [options.favor] - Conflict resolution preference.
 * @param {'normal'|'diff3'|'zealous_diff3'} [options.style] - Merge output style.
 * @param {number} [options.markerSize] - Conflict marker size (default: 7).
 * @returns {{conflict: boolean, output: Uint8Array}} An object containing conflict status and merged data.
 */
function mergeSync(o, a, b, options = {}) {
  if (!b4a.isBuffer(o) || !b4a.isBuffer(a) || !b4a.isBuffer(b)) {
    throw new Error('mergeSync() requires Uint8Array inputs')
  }
  const result = binding.mergeSync(o, a, b, options)
  return result
}

module.exports = {
  diff,
  merge,
  diffSync,
  mergeSync
}