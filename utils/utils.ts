import * as dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import path from 'path';

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export function getKeypairFromBase58Array(base58String: string): Keypair {
	if (!base58String) {
		throw new Error('Base58 string is not provided');
	}

	try {
		const secretKeyArray = JSON.parse(base58String);
		if (!Array.isArray(secretKeyArray)) {
			throw new Error('Base58 string must be a JSON array');
		}

		return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error('Base58 string must be a valid JSON array');
		}
		throw error;
	}
}
