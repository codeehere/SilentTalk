// NaCl E2E Encryption utilities
// Uses TweetNaCl — all crypto happens client-side only
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8 as bytesToUtf8, decodeUTF8 as utf8ToBytes } from 'tweetnacl-util';

const KEYPAIR_KEY = 'st_keypair';

/** Generate or retrieve a persistent NaCl keypair for this user */
export function getOrCreateKeypair() {
  const stored = localStorage.getItem(KEYPAIR_KEY);
  if (stored) {
    try {
      const { publicKey, secretKey } = JSON.parse(stored);
      if (publicKey && secretKey) {
        return {
          publicKey: new Uint8Array(decodeBase64(publicKey)),
          secretKey: new Uint8Array(decodeBase64(secretKey))
        };
      }
    } catch (e) {
      console.error('Error parsing stored keypair:', e);
    }
  }
  
  const kp = nacl.box.keyPair();
  localStorage.setItem(KEYPAIR_KEY, JSON.stringify({
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey)
  }));
  return {
    publicKey: new Uint8Array(kp.publicKey),
    secretKey: new Uint8Array(kp.secretKey)
  };
}

export function exportPublicKey() {
  const kp = getOrCreateKeypair();
  return encodeBase64(kp.publicKey);
}

/** Encrypt a plaintext message for a recipient's public key */
export function encryptMessage(plaintext, recipientPublicKeyB64) {
  if (!recipientPublicKeyB64) throw new Error('Recipient public key required');
  const kp = getOrCreateKeypair();
  const recipientPK = new Uint8Array(decodeBase64(recipientPublicKeyB64));
  if (recipientPK.length !== 32) throw new Error('Invalid recipient public key length');
  
  const nonce = new Uint8Array(nacl.randomBytes(nacl.box.nonceLength));
  // Ensure plaintext is a string
  const safePlaintext = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext || '');
  const messageBytes = utf8ToBytes(safePlaintext);
  
  const encrypted = nacl.box(messageBytes, nonce, recipientPK, new Uint8Array(kp.secretKey));
  if (!encrypted) throw new Error('Encryption failed');
  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce)
  };
}

/** Decrypt a message using our secret key */
export function decryptMessage(ciphertextB64, nonceB64, senderPublicKeyB64) {
  try {
    if (!senderPublicKeyB64) return '[Encrypted]';
    const kp = getOrCreateKeypair();
    const senderPK = new Uint8Array(decodeBase64(senderPublicKeyB64));
    if (senderPK.length !== 32) return '[Encrypted - Invalid Sender Key]';
    
    const ciphertext = new Uint8Array(decodeBase64(ciphertextB64));
    const nonce = new Uint8Array(decodeBase64(nonceB64));
    const decrypted = nacl.box.open(ciphertext, nonce, senderPK, new Uint8Array(kp.secretKey));
    if (!decrypted) return '[Encrypted message]';
    return bytesToUtf8(decrypted);
  } catch (err) {
    console.error('Decryption failed:', err);
    return '[Encrypted message]';
  }
}

/** For group messages: use secretbox with a shared group key derived from inviteCode */
export function encryptGroupMessage(plaintext, groupKeyB64) {
  const key = decodeBase64(groupKeyB64).slice(0, nacl.secretbox.keyLength);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const encrypted = nacl.secretbox(utf8ToBytes(plaintext), nonce, key);
  return { ciphertext: encodeBase64(encrypted), nonce: encodeBase64(nonce) };
}

export function decryptGroupMessage(ciphertextB64, nonceB64, groupKeyB64) {
  try {
    const key = decodeBase64(groupKeyB64).slice(0, nacl.secretbox.keyLength);
    const decrypted = nacl.secretbox.open(decodeBase64(ciphertextB64), decodeBase64(nonceB64), key);
    if (!decrypted) return '[Encrypted message]';
    return bytesToUtf8(decrypted);
  } catch {
    return '[Encrypted message]';
  }
}
