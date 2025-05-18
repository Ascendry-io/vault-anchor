import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

export const TEST_NFT_INFO = {
	productName: 'Super Mario Bros. 3 Wata Graded 9.0 Sealed A+',
	productDetailUri: 'https://gateway.irys.xyz/DUKAgE5kpPAgaLS4weGtZPJyKeZmPyjaZzKvneYo5Ec8',
};

// Use local validator RPC endpoint
export const TEST_RPC_CONNECTION = new Connection('http://127.0.0.1:8899', 'confirmed');

export const METADATA_PROGRAM_ID: PublicKey = new PublicKey(
	'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
);