import Irys from "@irys/sdk";
import { Keypair } from '@solana/web3.js';

const MIN_FUNDING_AMOUNT = 0.01; // 0.01 SOL minimum balance

export class IrysService {
  private irys: Irys;

  constructor(payerKeypair: Keypair, providerUrl: string) {
    this.irys = new Irys({
      url: "https://devnet.irys.xyz",
      network: "solana",
      token: "solana",
      key: payerKeypair.secretKey,
      config: { providerUrl }
    });
  }

  async initialize(): Promise<void> {
    await this.irys.ready();
    
    // Check and fund minimum balance
    const balance = await this.irys.getLoadedBalance();
    const balanceInSOL = this.irys.utils.unitConverter(balance).toNumber();
    
    if (balanceInSOL < MIN_FUNDING_AMOUNT) {
        const fundingAmount = this.irys.utils.toAtomic(MIN_FUNDING_AMOUNT);
        console.log(`Initial funding Irys with ${MIN_FUNDING_AMOUNT} SOL`);
        await this.irys.fund(fundingAmount);
    }
  }

  async getBalance(): Promise<string> {
    const balance = await this.irys.getLoadedBalance();
    return this.irys.utils.unitConverter(balance).toNumber().toString();
  }

  async uploadFile(data: Buffer, contentType: string): Promise<string> {
    try {
        const size = data.length;
        const cost = await this.irys.getPrice(size);
        
        const balance = await this.irys.getLoadedBalance();
        console.log(`Upload cost: ${this.irys.utils.unitConverter(cost).toNumber()} SOL`);
        console.log(`Current balance: ${this.irys.utils.unitConverter(balance).toNumber()} SOL`);
        
        if (balance.isLessThan(cost)) {
            const fundingAmount = cost.minus(balance);
            console.log(`Funding Irys with ${this.irys.utils.unitConverter(fundingAmount).toNumber()} SOL`);
            await this.irys.fund(fundingAmount);
        }

        const response = await this.irys.upload(data, {
            tags: [{ name: "Content-Type", value: contentType }],
        });

        console.log(`Upload response ID: ${response.id}`);
        console.log(`Upload response: ${JSON.stringify(response)}`);
        
        return `https://gateway.irys.xyz/${response.id}`;
    } catch (error) {
        console.error('Error uploading to Irys:', error);
        throw error;
    }
  }
} 