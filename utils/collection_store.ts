import fs from 'fs';
import { PublicKey } from '@solana/web3.js';

const COLLECTION_FILE = '.collection-address';
const NFT_MINT_FILE = '.nft-mint';
export function saveCollectionAddress(address: string) {
	fs.writeFileSync(COLLECTION_FILE, address);
}

export function saveNftMintAddress(address: string) {
	fs.writeFileSync(NFT_MINT_FILE, address);
}

export function getCollectionAddress(): PublicKey {
	if (!fs.existsSync(COLLECTION_FILE)) {
		throw new Error('Collection has not been created yet. Run create_collection test first.');
	}
	const address = fs.readFileSync(COLLECTION_FILE, 'utf8');
	return new PublicKey(address);
}

export function getNftAddress(): PublicKey {
	if (!fs.existsSync(NFT_MINT_FILE)) {
		throw new Error('NFT has not been minted yet. Run mint_nft test first.');
	}
	const address = fs.readFileSync(NFT_MINT_FILE, 'utf8');
	return new PublicKey(address);
}
