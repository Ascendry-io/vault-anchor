import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Connection } from '@solana/web3.js';
import { CollectibleVault } from '../target/types/collectible_vault';

// Helper function to format SOL amounts with 4 decimal places
export const formatSOL = (lamports: number | anchor.BN): string => {
    const amount = lamports instanceof anchor.BN ? lamports.toNumber() : lamports;
    return (amount / anchor.web3.LAMPORTS_PER_SOL).toFixed(4) + " SOL";
};

// Helper function to log account balances
export const logBalances = async (
    connection: Connection,
    accounts: PublicKey[],
    labels: string[]
): Promise<void> => {
    console.log("--------- ACCOUNT BALANCES ---------");
    for (let i = 0; i < accounts.length; i++) {
        const balance = await connection.getBalance(accounts[i]);
        console.log(`${labels[i]}: ${formatSOL(balance)}`);
    }
    console.log("------------------------------------");
};

// Helper function to get balances for multiple accounts
export const getBalances = async (
    program: anchor.Program<CollectibleVault>,
    accounts: Array<{ key: PublicKey, label: string }>
): Promise<Array<{ key: PublicKey, label: string, balance: number }>> => {
    const balances = await Promise.all(
        accounts.map(async ({ key, label }) => ({
            key,
            label,
            balance: await program.provider.connection.getBalance(key),
        }))
    );
    
    console.log("\n--------- ACCOUNT BALANCES ---------");
    balances.forEach(({ label, balance }) => {
        console.log(`${label}: ${formatSOL(balance)}`);
    });
    console.log("------------------------------------\n");

    return balances;
};

// Helper function to log balance changes
export const logBalanceChanges = (
    before: Array<{ key: PublicKey, label: string, balance: number }>,
    after: Array<{ key: PublicKey, label: string, balance: number }>
): void => {
    console.log("\n--------- BALANCE CHANGES ---------");
    before.forEach((beforeAccount) => {
        const afterAccount = after.find(a => a.key.equals(beforeAccount.key));
        if (afterAccount) {
            const change = afterAccount.balance - beforeAccount.balance;
            console.log(`${beforeAccount.label}: ${formatSOL(change)} SOL`);
        }
    });
    console.log("----------------------------------\n");
}; 