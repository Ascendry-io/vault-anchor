import bs58 from 'bs58';

// Replace this with your actual private key
const privateKey = '';

function convertPrivateKeyToBase58Array(privateKey: string): number[] {
    try {
        // Decode the base58 private key to a Uint8Array
        const decoded = bs58.decode(privateKey);
        
        // Convert Uint8Array to regular array of numbers
        const numberArray = Array.from(decoded);
        
        console.log('Base58 Array:', numberArray);
        return numberArray;
    } catch (error) {
        console.error('Error converting private key:', error);
        throw error;
    }
}

// Example usage
const base58Array = convertPrivateKeyToBase58Array(privateKey);
console.log('Base58 Array:', base58Array);
// Remove spaces in array and make string
const base58String = base58Array.join('');
console.log('Base58 String:', base58String);
console.log('Length:', base58Array.length);

