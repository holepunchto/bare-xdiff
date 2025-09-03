const binding = require('./binding')

/**
 * Generates a patch from two Strings.
 * @param {String} a - The original text.
 * @param {String} b - The modified text.
 * @param {Object} [options] - Diff options.
 * @param {boolean} [options.ignoreWhitespace] - Ignore whitespace differences.
 * @param {boolean} [options.ignoreWhitespaceChange] - Ignore changes in whitespace.
 * @param {boolean} [options.ignoreWhitespaceAtEol] - Ignore whitespace at end of line.
 * @param {boolean} [options.ignoreBlankLines] - Ignore blank line changes.
 * @param {'minimal'|'patience'|'histogram'} [options.algorithm] - Diff algorithm to use.
 * @returns {Promise<String>} A Promise that resolves with a String containing the patch.
 */
async function diff(a, b, options = {}) {
  return new Promise((resolve, reject) => {
    binding.diff(a, b, options, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}


/**
 * Merges two Strings based on an original String.
 * @param {String} o - The original text.
 * @param {String} a - The first modified text.
 * @param {String} b - The second modified text.
 * @param {Object} [options] - Merge options.
 * @param {'minimal'|'eager'|'zealous'|'zealous_alnum'} [options.level] - Merge simplification level.
 * @param {'ours'|'theirs'|'union'} [options.favor] - Conflict resolution preference.
 * @param {'normal'|'diff3'|'zealous_diff3'} [options.style] - Merge output style.
 * @param {number} [options.markerSize] - Conflict marker size (default: 7).
 * @returns {Promise<String>} A Promise that resolves with the merged text.
 */
async function merge(o, a, b, options = {}) {
  return new Promise((resolve, reject) => {
    binding.merge(o, a, b, options, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

/**
 * Generates a patch from two Strings (synchronous version).
 * @param {String} a - The original text.
 * @param {String} b - The modified text.
 * @param {Object} [options] - Diff options.
 * @param {boolean} [options.ignoreWhitespace] - Ignore whitespace differences.
 * @param {boolean} [options.ignoreWhitespaceChange] - Ignore changes in whitespace.
 * @param {boolean} [options.ignoreWhitespaceAtEol] - Ignore whitespace at end of line.
 * @param {boolean} [options.ignoreBlankLines] - Ignore blank line changes.
 * @param {'minimal'|'patience'|'histogram'} [options.algorithm] - Diff algorithm to use.
 * @returns {String} A String containing the patch.
 */
function diffSync(a, b, options = {}) {
  const result = binding.diffSync(a, b, options)
  return result
}

/**
 * Merges two Strings based on an original String (synchronous version).
 * @param {String} o - The original text.
 * @param {String} a - The first modified text.
 * @param {String} b - The second modified text.
 * @param {Object} [options] - Merge options.
 * @param {'minimal'|'eager'|'zealous'|'zealous_alnum'} [options.level] - Merge simplification level.
 * @param {'ours'|'theirs'|'union'} [options.favor] - Conflict resolution preference.
 * @param {'normal'|'diff3'|'zealous_diff3'} [options.style] - Merge output style.
 * @param {number} [options.markerSize] - Conflict marker size (default: 7).
 * @returns {String} The merged text.
 */
function mergeSync(o, a, b, options = {}) {
  const result = binding.mergeSync(o, a, b, options)
  return result
}

module.exports = {
  diff,
  merge,
  diffSync,
  mergeSync
}