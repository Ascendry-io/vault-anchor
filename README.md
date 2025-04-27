# Ascendry Vault

This is the core vault package used by [Ascendry.io](https://ascendry.io) for managing inventory and loan actions on the Solana blockchain. The vault allows users to:

- Create and manage NFT collections (only Ascendry admin can)
- Mint NFTs within collections (only Ascendry admin can)
- Stake NFTs as collateral for loans (nft owners can initiate)
- Provide and manage loan liquidity (any solana wallet can provide loan liquidity)
- Handle loan repayments and delinquencies

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or later)
- [Rust](https://www.rust-lang.org/tools/install)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://book.anchor-lang.com/getting_started/installation.html)

## Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd vault
```

2. Install dependencies:
```bash
npm install
```

3. Build the program:
```bash
anchor build
```

4. Configure your Solana environment:
```bash
# Set to devnet
solana config set --url devnet

# Create a new wallet if needed
solana-keygen new
```

To airdrop $SOL on devnet, use [Solana Faucet](https://faucet.solana.com)

## Testing

The project includes comprehensive tests for all major functionality. Tests are organized in the following order:

1. `1_create_collection.ts` - Collection creation and management
2. `2_mint_nft.ts` - NFT minting within collections
3. `3_loan_flow.ts` - Complete loan lifecycle testing

To run the tests:

```bash
# Run all tests
anchor test
```

## Test Flow

### 1. Collection Creation
- Creates a new NFT collection
- Verifies collection metadata
- Tests unauthorized access prevention

### 2. NFT Minting
- Mints NFTs within the collection
- Verifies NFT ownership
- Tests minting permissions

### 3. Loan Flow
- NFT staking for loans
- Loan liquidity provision
- Loan repayment
- Delinquent NFT claiming
- Loan cancellation

## Project Structure

```
vault/
├── programs/              # Solana program source code
│   └── collectible_vault/ # Main program
├── tests/                 # Test files
│   ├── 1_create_collection.ts
│   ├── 2_mint_nft.ts
│   ├── 3_loan_flow.ts
│   └── test-utils.ts      # Shared test utilities
├── utils/                 # Utility functions
└── target/               # Build output
```

## Development

### Adding New Features

1. Add new instructions in `programs/collectible_vault/src/instructions/`
2. Update the program's `lib.rs` to include new instructions
3. Add corresponding tests in the appropriate test file
4. Run tests to verify functionality

### Common Commands

```bash
# Build the program
anchor build

# Deploy to devnet
anchor deploy

# Run tests
anchor test

# Generate IDL
anchor idl build

# Generate TypeScript types
anchor build -- --features types
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the terms specified in the LICENSE file.

## About Ascendry.io

[Ascendry.io](https://ascendry.io) is a platform for managing digital assets and loans on the Solana blockchain. This vault package is a core component of Ascendry's infrastructure, enabling secure and efficient management of NFT collections and loan operations.

For more information about Ascendry.io, visit our [website](https://ascendry.io) or contact us at [rastaar@ascendry.io](mailto:rastaar@ascendry.io). 