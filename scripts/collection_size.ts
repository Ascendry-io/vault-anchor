// Using Metaplex JS SDK
import {
  PublicKey,
  Connection,
  clusterApiUrl,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';

import { getPayerKeypair } from '../utils/utils';
import { COLLECTION_MINT, METADATA_PROGRAM_ID } from './constants';


async function getCollectionSize() {

    const payerKeypair = getPayerKeypair();

    // Solana connection
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');


    // Derive collection metadata PDA
    const [collectionMetadataPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            METADATA_PROGRAM_ID.toBuffer(),
            COLLECTION_MINT.toBuffer(),
        ],
        METADATA_PROGRAM_ID
    );

    // Fetch the metadata account
    const metadataAccount = await connection.getAccountInfo(collectionMetadataPDA);
    
    console.log(metadataAccount.data);
    console.log("Raw data:", metadataAccount.data.toString('hex'));

}

getCollectionSize().then(() => {
    console.log('Collection size fetched successfully');
});