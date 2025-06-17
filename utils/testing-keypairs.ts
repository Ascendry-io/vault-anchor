import { Keypair } from '@solana/web3.js';
import { getKeypairFromBase58Array } from './utils';

// Load environment variables
const PRIVATE_KEY_BASE_58 = process.env.PRIVATE_KEY_BASE_58;
const ALT_PRIVATE_KEY_BASE_58 = process.env.ALT_PRIVATE_KEY_BASE_58;

if (!PRIVATE_KEY_BASE_58 || !ALT_PRIVATE_KEY_BASE_58) {
	throw new Error('Required environment variables are not set');
}

export const PAYER_KEYPAIR: Keypair = getKeypairFromBase58Array(PRIVATE_KEY_BASE_58);
export const ALTERNATIVE_PAYER_KEYPAIR: Keypair =
	getKeypairFromBase58Array(ALT_PRIVATE_KEY_BASE_58);

// Log the public keys for verification
console.log('Payer Keypair: ', PAYER_KEYPAIR.publicKey.toBase58());
console.log('Alternative Payer Keypair: ', ALTERNATIVE_PAYER_KEYPAIR.publicKey.toBase58());
