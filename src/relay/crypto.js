import { PrivateKey, PublicKey } from 'bitcore-lib-cash'

const forge = require('node-forge')
const cashlib = require('bitcore-lib-cash')

export default {
  constructStealthPubKey (emphemeralPrivKey, destPubKey) {
    let dhKeyPoint = destPubKey.point.mul(emphemeralPrivKey.bn) // ebG
    let dhKeyPointRaw = cashlib.crypto.Point.pointToCompressed(dhKeyPoint)

    let digest = cashlib.crypto.Hash.sha256(dhKeyPointRaw) // H(ebG)
    let digestPublicKey = PrivateKey.fromBuffer(digest).toPublicKey() // H(ebG)G

    let stealthPublicKey = PublicKey(digestPublicKey.point.add(destPubKey.point)) // H(ebG)G + bG
    return stealthPublicKey
  },
  constructStealthPrivKey (emphemeralPubKey, privKey) {
    let dhKeyPoint = emphemeralPubKey.point.mul(privKey.bn) // ebG
    let dhKeyPointRaw = cashlib.crypto.Point.pointToCompressed(dhKeyPoint)

    let digest = cashlib.crypto.Hash.sha256(dhKeyPointRaw) // H(ebG)
    let digestBn = cashlib.crypto.BN.fromBuffer(digest)

    let stealthPrivBn = digestBn.add(privKey.bn).mod(cashlib.crypto.Point.getN()) // H(ebG) + b
    return PrivateKey(stealthPrivBn)
  },
  constructStampPubKey (payloadDigest, destPubKey) {
    let digestPrivateKey = PrivateKey.fromBuffer(payloadDigest)
    let digestPublicKey = digestPrivateKey.toPublicKey()

    let stampPoint = digestPublicKey.point.add(destPubKey.point)
    let stampPublicKey = PublicKey.fromPoint(stampPoint)

    return stampPublicKey
  },
  constructStampPrivKey (payloadDigest, privKey) {
    let digestBn = cashlib.crypto.BN.fromBuffer(payloadDigest)
    let stampPrivBn = privKey.bn.add(digestBn).mod(cashlib.crypto.Point.getN()) // TODO: Check this
    let stampPrivKey = PrivateKey(stampPrivBn)
    return stampPrivKey
  },
  constructStampAddress (payloadDigest, privKey) {
    let digestBn = cashlib.crypto.BN.fromBuffer(payloadDigest)
    let stampPrivBn = privKey.bn.add(digestBn).mod(cashlib.crypto.Point.getN()) // TODO: Check this
    let stampAddress = PrivateKey(stampPrivBn).toAddress('testnet')
    return stampAddress
  },
  encrypt (plainText, privKey, destPubKey) {
    // Generate new (random) emphemeral key
    let ephemeralPrivKey = PrivateKey()
    let emphemeralPrivKeyBn = ephemeralPrivKey.toBigNumber()

    // Construct DH key
    let dhKeyPoint = destPubKey.point.mul(emphemeralPrivKeyBn).add(privKey.toPublicKey().point)
    let dhKeyPointRaw = cashlib.crypto.Point.pointToCompressed(dhKeyPoint)

    // Extract encryption params from digest
    let digest = cashlib.crypto.Hash.sha256(dhKeyPointRaw)
    let iv = new forge.util.ByteBuffer(digest.slice(0, 16)) // TODO: Double check whether IV is appropriate
    let key = new forge.util.ByteBuffer(digest.slice(16))

    // Encrypt entries
    let cipher = forge.aes.createEncryptionCipher(key, 'CBC')
    cipher.start(iv)
    let rawBuffer = new forge.util.ByteBuffer(plainText)
    cipher.update(rawBuffer)
    cipher.finish()
    let cipherText = Uint8Array.from(Buffer.from(cipher.output.toHex(), 'hex')) // TODO: Faster

    // Get empheral public key point
    let ephemeralPubKey = ephemeralPrivKey.toPublicKey()

    return { cipherText, ephemeralPubKey }
  },
  decrypt (cipherText, destPrivKey, sourcePubkey, ephemeralPubKey) {
    // Construct DH key
    let destPrivKeyBn = destPrivKey.toBigNumber()
    let dhKeyPoint = ephemeralPubKey.point.mul(destPrivKeyBn).add(sourcePubkey.point)
    let dhKeyPointRaw = cashlib.crypto.Point.pointToCompressed(dhKeyPoint)

    // Extract encryption params from digest
    let digest = cashlib.crypto.Hash.sha256(dhKeyPointRaw)
    let iv = new forge.util.ByteBuffer(digest.slice(0, 16)) // TODO: Double check whether IV is appropriate
    let key = new forge.util.ByteBuffer(digest.slice(16))

    // Encrypt entries
    let cipher = forge.aes.createDecryptionCipher(key, 'CBC')
    cipher.start(iv)
    let rawBuffer = new forge.util.ByteBuffer(cipherText)
    cipher.update(rawBuffer)
    cipher.finish()
    let plainText = Uint8Array.from(Buffer.from(cipher.output.toHex(), 'hex')) // TODO: Faster
    return plainText
  }
}
