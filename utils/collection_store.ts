import fs from 'fs';
import { PublicKey } from '@solana/web3.js';

const COLLECTION_FILE = '.collection-address';

export function saveCollectionAddress(address: string) {
    fs.writeFileSync(COLLECTION_FILE, address);
}

export function getCollectionAddress(): PublicKey {
    if (!fs.existsSync(COLLECTION_FILE)) {
        throw new Error('Collection has not been created yet. Run create_collection test first.');
    }
    const address = fs.readFileSync(COLLECTION_FILE, 'utf8');
    return new PublicKey(address);
} 