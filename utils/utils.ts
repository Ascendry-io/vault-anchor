import * as dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import path from 'path';

// Load .env file from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export function getPayerKeypair(): Keypair {
    const secretKey58 = process.env.PRIVATE_KEY_BASE_58;
    if (!secretKey58) {
        throw new Error('PRIVATE_KEY_BASE_58 is not set in the environment variables');
    }
    
    try {
        const secretKeyArray = JSON.parse(secretKey58);
        if (!Array.isArray(secretKeyArray)) {
            throw new Error('PRIVATE_KEY_BASE_58 must be a JSON array');
        }
        
        return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error('PRIVATE_KEY_BASE_58 must be a valid JSON array');
        }
        throw error;
    }
}

export function getAlternativePayerKeypair(): Keypair {
    const secretKey58 = process.env.ALT_PRIVATE_KEY_BASE_58;
    if (!secretKey58) {
        throw new Error('ALT_PRIVATE_KEY_BASE_58 is not set in the environment variables');
    }
    
    try {
        const secretKeyArray = JSON.parse(secretKey58);
        if (!Array.isArray(secretKeyArray)) {
            throw new Error('ALT_PRIVATE_KEY_BASE_58 must be a JSON array');
        }
        
        return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error('ALT_PRIVATE_KEY_BASE_58 must be a valid JSON array');
        }
        throw error;
    }
}
