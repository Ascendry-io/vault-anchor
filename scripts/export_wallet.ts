import bs58 from 'bs58';
import * as dotenv from 'dotenv';
import { getPayerKeypair, getAlternativePayerKeypair } from '../utils/utils';

dotenv.config();

function printWalletPrivateKey() {
    
    // Create keypair from bytes
    const keypair1 = getPayerKeypair();
    const keypair2 = getAlternativePayerKeypair();
    
    // Get private key in hex format
    const privateKeyHex1 = Buffer.from(keypair1.secretKey).toString('hex');
    const privateKeyHex2 = Buffer.from(keypair2.secretKey).toString('hex');
    
    console.log('\nWallet Export Formats:');
    console.log('----------------------');
    console.log('Public Key:', keypair1.publicKey.toBase58());
    console.log('Private Key (base58):', bs58.encode(keypair1.secretKey));
    console.log('Private Key (hex):', privateKeyHex1);
    console.log('Private Key (base58):', bs58.encode(keypair2.secretKey));
    console.log('Private Key (hex):', privateKeyHex2);
}

printWalletPrivateKey();