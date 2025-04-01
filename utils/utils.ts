import * as dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';

dotenv.config();

export function getPayerKeypair(): Keypair {
  const secretKey58 = process.env.PRIVATE_KEY_BASE_58 || '';
  if (!secretKey58) {
    throw new Error('PRIVATE_KEY_BASE_58 is not set in the environment variables');
  }
  const secretKeyArray = JSON.parse(secretKey58); // Parse JSON
  console.log(Keypair.fromSecretKey(Uint8Array.from(secretKeyArray)).publicKey.toBase58());
  return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
}

export function getAlternativePayerKeypair(): Keypair {
  const secretKey58 = process.env.ALT_PRIVATE_KEY_BASE_58 || '';
  const secretKeyArray = JSON.parse(secretKey58); // Parse JSON
  return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
}
