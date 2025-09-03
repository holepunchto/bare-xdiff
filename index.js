const binding = require('./binding')

/**
 * Generates a patch from two buffers.
 * @param {Buffer | ArrayBuffer} a - The original buffer.
 * @param {Buffer | ArrayBuffer} b - The modified buffer.
 * @returns {Promise<Buffer>} A Promise that resolves with a buffer containing the patch.
 */
async function diff(a, b) {
  if (!Buffer.isBuffer(a)) a = Buffer.from(a)
  if (!Buffer.isBuffer(b)) b = Buffer.from(b)
  
  return new Promise((resolve, reject) => {
    binding.diff(a, b, (err, result) => {
      if (err) reject(err)
      else resolve(Buffer.from(result))
    })
  })
}

/**
 * Applies a patch to a buffer.
 * @param {Buffer | ArrayBuffer} a - The original buffer.
 * @param {Buffer | ArrayBuffer} patch - The patch buffer.
 * @returns {Promise<Buffer>} A Promise that resolves with the patched buffer.
 */
async function patch(a, patchBuffer) {
  if (!Buffer.isBuffer(a)) a = Buffer.from(a)
  if (!Buffer.isBuffer(patchBuffer)) patchBuffer = Buffer.from(patchBuffer)
  
  return new Promise((resolve, reject) => {
    binding.patch(a, patchBuffer, (err, result) => {
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
 * @returns {Promise<Buffer>} A Promise that resolves with the merged buffer.
 */
async function merge(o, a, b) {
  if (!Buffer.isBuffer(o)) o = Buffer.from(o)
  if (!Buffer.isBuffer(a)) a = Buffer.from(a)
  if (!Buffer.isBuffer(b)) b = Buffer.from(b)
  
  return new Promise((resolve, reject) => {
    binding.merge(o, a, b, (err, result) => {
      if (err) reject(err)
      else resolve(Buffer.from(result))
    })
  })
}

module.exports = {
  diff,
  patch,
  merge
}