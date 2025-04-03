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

  async uploadMetadata(imageUrl: string): Promise<string> {
    console.log("Creating and uploading metadata...");
    const metadata = this.createMetadata(imageUrl);
    const metadataBuffer = Buffer.from(JSON.stringify(metadata));
    return await this.irysService.uploadFile(metadataBuffer, "application/json");
  }

  private createMetadata(imageUrl: string): NftMetadata {
    return {
      name: "Sample NFT",
      symbol: "BT",
      description: "A sample NFT created for Arweave testnet",
      seller_fee_basis_points: 500,
      image: imageUrl,
      attributes: [
        { trait_type: "Wata ID", value: "607149-001" },
        { trait_type: "Country of Origin", value: "Japan" },
        { trait_type: "Overall Grade", value: "9.0" },
        { trait_type: "Seal Grade", value: "9.0" },
        { trait_type: "Game Name", value: "Super Mario Bros. 3" },
        { trait_type: "Platform", value: "NES" },
        { trait_type: "Authentication Date", value: "3/25/2025" }
      ],
      properties: {
        files: [{ uri: imageUrl, type: "image/png" }],
        category: "image",
        creators: [{
          address: this.wallet.publicKey.toString(),
          share: 100
        }]
      }
    };
  }
} 