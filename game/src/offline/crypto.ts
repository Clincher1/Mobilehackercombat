import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

// Only the synchronous operations required by the local game engine.
const cryptoShim = {
  randomUUID: () => {
    if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = bytesToHex(bytes);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  },
  createHash(algorithm: string) {
    if (algorithm !== 'sha256') throw new Error('Unsupported hash');
    let value = '';
    return {
      update(input: string) { value += input; return this; },
      digest(encoding?: string) {
        const hash = sha256(utf8ToBytes(value));
        if (encoding === 'hex') return bytesToHex(hash);
        return Object.assign(hash, { readUInt32BE: (offset: number) => new DataView(hash.buffer, hash.byteOffset).getUint32(offset) });
      },
    };
  },
};
export default cryptoShim;
