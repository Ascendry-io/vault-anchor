import { Connection } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

export const TEST_NFT_INFO = {
	productName: 'Super Mario Bros. 3 Wata Graded 9.0 Sealed A+',
	productDetailUri: 'https://gateway.irys.xyz/DUKAgE5kpPAgaLS4weGtZPJyKeZmPyjaZzKvneYo5Ec8',
};

const getRpcEndpoint = 'https://devnet.helius-rpc.com/?api-key=' + process.env.HELIUS_API_KEY!;
console.log(getRpcEndpoint);
export const RPC_CONNECTION = new Connection(getRpcEndpoint, 'confirmed');
