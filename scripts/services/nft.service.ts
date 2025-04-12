import { NftMetadata } from '../types/nft.types';
import { IrysService } from './irys.service';
import fs from 'fs';
import { Wallet } from '@coral-xyz/anchor';

export class NftService {
  constructor(
    private readonly irysService: IrysService,
    private readonly wallet: Wallet
  ) {}

  async uploadImage(imagePath: string): Promise<string> {
    console.log("Uploading image to Arweave...");
    const imageData = fs.readFileSync(imagePath);
    return await this.irysService.uploadFile(imageData, "image/png");
  }

  async uploadMetadata(imageUrl: string, fileUrls: string[], itemNumber: number): Promise<string> {
    console.log("Creating and uploading metadata...");
    const metadata = this.createMetadata(imageUrl, fileUrls, itemNumber);
    const metadataBuffer = Buffer.from(JSON.stringify(metadata));
    return await this.irysService.uploadFile(metadataBuffer, "application/json");
  }

  private createMetadata(imageUrl: string, fileUrls: string[], itemNumber: number): NftMetadata {
    return {
      name: `Banked Item #${itemNumber}`,
      symbol: "BT",
      description: "A sample NFT created for Arweave testnet",
      seller_fee_basis_points: 500,
      image: imageUrl,
      attributes: [
        { trait_type: "Item Number", value: itemNumber.toString() },
        { trait_type: "Wata ID", value: "607149-001" },
        { trait_type: "Country of Origin", value: "Japan" },
        { trait_type: "Overall Grade", value: "9.0" },
        { trait_type: "Seal Grade", value: "9.0" },
        { trait_type: "Game Name", value: "Super Mario Bros. 3" },
        { trait_type: "Platform", value: "NES" },
        { trait_type: "Authentication Date", value: "3/25/2025" },
        { trait_type: "Certificate", value: "Yes" },
        { trait_type: "Vendor Name", value: "Vault" },
        { trait_type: "Vendor Address", value: "FGnCxeh3WrdrQ3yeFmU34UMRKRXFtkoRikeXxvPvMW8r" },
      ],
      properties: {
        files: [...fileUrls.map(url => ({ uri: url, type: "image/png" }))],
        category: "image",
        creators: [{
          address: this.wallet.publicKey.toString(),
          share: 100
        }]
      }
    };
  }
} 