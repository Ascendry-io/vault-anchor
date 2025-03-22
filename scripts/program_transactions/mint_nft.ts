// Mint NFT
import * as anchor from '@coral-xyz/anchor';
import {
  Keypair,
  PublicKey,
  Connection,
  clusterApiUrl,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getPayerKeypair } from '../../utils/utils';
import idl from '../../target/idl/collectible_vault.json'; // Import the IDL JSON
import { CollectibleVault } from '../../target/types/collectible_vault'; // Import TypeScript types
import { COLLECTION_COUNTER, COLLECTION_MINT, METADATA_PROGRAM_ID } from '../constants';

const payerKeypair = getPayerKeypair();

// Solana connection
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(payerKeypair), {
  preflightCommitment: 'confirmed',
});
anchor.setProvider(provider);

const program = new anchor.Program<CollectibleVault>(idl as CollectibleVault, provider);

// Creates Metaplex NFT Collection from anchor instruction.
async function createNft() {
  await checkCollection();
  console.log('Creating individual NFT...');

  // Add compute budget instruction
  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 300000
  });

  // Generate a new mint keypair for the collection
  const mint = Keypair.generate();

  // Derive PDA for metadata account
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      new PublicKey(
        idl.instructions
          .find((i) => i.name === 'mint_nft')
          ?.accounts.find((a) => a.name === 'token_metadata_program')?.address!
      ).toBuffer(),
      mint.publicKey.toBuffer(),
    ],
    new PublicKey(
      idl.instructions
        .find((i) => i.name === 'mint_nft')
        ?.accounts.find((a) => a.name === 'token_metadata_program')?.address!
    )
  );

  // Derive PDA for master edition account
  const [masterEditionPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.publicKey.toBuffer(),
      Buffer.from('edition'),
    ],
    METADATA_PROGRAM_ID
  );

  // Derive collection metadata PDA
  const [collectionMetadataPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), COLLECTION_MINT.toBuffer()],
    METADATA_PROGRAM_ID
  );

  // Derive collection master edition PDA
  const [collectionMasterEditionPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      COLLECTION_MINT.toBuffer(),
      Buffer.from('edition'),
    ],
    METADATA_PROGRAM_ID
  );

  // Derive or use a dummy for collection authority record
  const [collectionAuthorityRecord] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      COLLECTION_MINT.toBuffer(),
      Buffer.from('collection_authority'),
      payerKeypair.publicKey.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );

  // Get the associated token account for the payer
  const tokenAccount = await getAssociatedTokenAddress(mint.publicKey, payerKeypair.publicKey);

  console.log('Minting with accounts:');
  console.log(`- Mint: ${mint.publicKey.toString()}`);
  console.log(`- Metadata: ${metadataPDA.toString()}`);
  console.log(`- Master Edition: ${masterEditionPDA.toString()}`);
  console.log(`- Collection Mint: ${COLLECTION_MINT.toString()}`);
  console.log(`- Collection Metadata: ${collectionMetadataPDA.toString()}`);
  console.log(`- Collection Counter: ${COLLECTION_COUNTER.toString()}`);
  const accounts = {
    mint: mint.publicKey,
    metadata: metadataPDA,
    masterEdition: masterEditionPDA,
    tokenAccount: tokenAccount,
    payer: payerKeypair.publicKey,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
    tokenMetadataProgram: METADATA_PROGRAM_ID,
    collection: collectionMetadataPDA, // This is the same as collectionMetadata if you refactored
    collectionMint: COLLECTION_MINT,
    collectionMetadata: collectionMetadataPDA,
    collectionMasterEdition: collectionMasterEditionPDA,
    collectionCounter: COLLECTION_COUNTER,
    // collectionAuthorityRecord: collectionAuthorityRecord,
  };

  const tx = await program.methods
    .mintNft('https://metadata.y00ts.com/y/6869.json')
    .accounts(accounts)
    .preInstructions([modifyComputeUnits])
    .signers([payerKeypair, mint])
    .rpc();

  console.log(`✅ Individual NFT Created! TX: ${tx}`);
  console.log(`NFT Mint Address: ${mint.publicKey.toBase58()}`);
}

async function checkCollection() {
  try {
    const accountInfo = await connection.getAccountInfo(COLLECTION_MINT);
    console.log('Collection exists:', accountInfo !== null);

    if (accountInfo) {
      // Instead, derive the metadata PDA and check that
      const [collectionMetadataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), COLLECTION_MINT.toBuffer()],
        METADATA_PROGRAM_ID
      );

      const metadataAccountInfo = await connection.getAccountInfo(collectionMetadataPDA);
      console.log('Collection metadata exists:', metadataAccountInfo !== null);

      // Also check the master edition
      const [collectionMasterEditionPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          METADATA_PROGRAM_ID.toBuffer(),
          COLLECTION_MINT.toBuffer(),
          Buffer.from('edition'),
        ],
        METADATA_PROGRAM_ID
      );

      const masterEditionAccountInfo = await connection.getAccountInfo(collectionMasterEditionPDA);
      console.log('Collection master edition exists:', masterEditionAccountInfo !== null);
    }
  } catch (error) {
    console.error('Error checking collection:', error);
  }
}

createNft().catch(console.error);
