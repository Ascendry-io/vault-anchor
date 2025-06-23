# Ascendry Vault

This is the core vault package used by [Ascendry.io](https://ascendry.io) for managing digital collectibles, loans, and asset redemptions on the Solana blockchain. The vault provides a comprehensive platform for:

- **Collection Management**: Create and manage NFT collections (admin-only)
- **NFT Minting**: Mint NFTs within collections with product detail URIs (admin-only)
- **Asset Redemption**: Enable NFT owners to redeem their digital collectibles for physical assets
- **NFT-Backed Lending**: Complete loan lifecycle management using NFTs as collateral
- **Liquidity Provision**: Allow any Solana wallet to provide loan liquidity

## Core Features

### 🏛️ Collection & NFT Management
- **Create Collections**: Admin-only collection creation with metadata
- **Mint NFTs**: Admin-only NFT minting with product detail URIs
- **Collection Tracking**: Automatic counter management for NFT collections

### 💎 Asset Redemption System
- **Create Redemption Requests**: NFT owners can request physical asset redemption
- **Cancel Redemption Requests**: NFT owners can cancel pending redemption requests
- **Fulfill Redemption Requests**: Admin-only fulfillment of redemption requests
- **Secure Vault Storage**: NFTs are securely held in program-controlled vaults during redemption

### 💰 NFT-Backed Lending Platform
- **Stake NFTs for Loans**: NFT owners can stake their collectibles as loan collateral
- **Flexible Loan Terms**: Customizable loan amounts, interest rates, and durations
- **Provide Liquidity**: Any Solana wallet can fund loan requests
- **Loan Repayment**: Borrowers can repay loans with interest
- **Delinquency Management**: Automatic NFT transfer to lenders for delinquent loans
- **Loan Cancellation**: Borrowers can cancel unfunded loan requests

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
cd vault-anchor
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
4. `4_asset_redemption.ts` - Asset redemption system testing

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
- Verifies NFT ownership and metadata
- Tests minting permissions

### 3. Loan Flow
- NFT staking for loans with custom terms
- Loan liquidity provision by lenders
- Loan repayment with interest
- Delinquent NFT claiming by lenders
- Loan request cancellation by borrowers
- Complete account cleanup verification

### 4. Asset Redemption
- NFT owners create redemption requests
- NFTs are transferred to secure vault
- Admin fulfillment of redemption requests
- Request cancellation by NFT owners
- Proper account management and cleanup

## Program Architecture

### State Management
The program's state structures are organized in the `state/` folder for better maintainability:

- **CollectionCounter** (`state/collection_counter.rs`): Tracks NFT counts within collections
- **LoanInfo** (`state/loan_info.rs`): Manages loan details, terms, and status  
- **AssetRedemptionInfo** (`state/asset_redemption_info.rs`): Tracks redemption requests and fulfillment status

Each state structure includes:
- Account attributes and derive macros
- Comprehensive documentation
- Space calculation constants for account initialization
- Implementation methods for account-specific functionality

### Key Instructions

#### Admin Operations
- `create_collection()` - Create new NFT collections
- `mint_nft(product_detail_uri)` - Mint NFTs with product details

#### Asset Redemption
- `create_asset_redemption_request()` - Initiate redemption request
- `cancel_asset_redemption_request()` - Cancel pending request
- `fulfill_asset_redemption_request()` - Admin fulfillment

#### Loan Management
- `stake_nft_for_loan(loan_amount, interest_rate, duration)` - Stake NFT for loan
- `provide_loan_liquidity()` - Fund loan requests
- `repay_loan()` - Repay loans with interest
- `claim_delinquent_nft()` - Claim NFT for delinquent loans
- `cancel_loan_request()` - Cancel unfunded loan requests

## Project Structure

```
vault-anchor/
├── programs/                    # Solana program source code
│   └── collectible_vault/       # Main program
│       ├── src/
│       │   ├── instructions/    # Program instructions
│       │   │   ├── admin_operations/     # Collection & NFT management
│       │   │   ├── asset_redemption/     # Asset redemption system
│       │   │   └── loans/               # Loan management
│       │   ├── state/           # Account state structures
│       │   │   ├── mod.rs               # Module exports
│       │   │   ├── collection_counter.rs # Collection counter state
│       │   │   ├── loan_info.rs         # Loan information state
│       │   │   └── asset_redemption_info.rs # Asset redemption state
│       │   ├── constants/       # Program constants
│       │   └── errors.rs        # Custom error definitions
├── tests/                       # Test files
│   ├── 1_create_collection.ts
│   ├── 2_mint_nft.ts
│   ├── 3_loan_flow.ts
│   ├── 4_asset_redemption.ts
│   └── test-utils.ts           # Shared test utilities
├── utils/                       # Utility functions
└── target/                     # Build output
```

## Development

### Adding New Features

1. Add new instructions in `programs/collectible_vault/src/instructions/`
2. Add new state structures in `programs/collectible_vault/src/state/` if needed
3. Update the program's `lib.rs` to include new instructions
4. Add corresponding tests in the appropriate test file
5. Run tests to verify functionality

**Adding New State Structures:**
- Create a new file in `src/state/` (e.g., `new_state.rs`)
- Include proper imports: `use anchor_lang::prelude::*;`
- Add account attributes and derive macros as needed
- Include space calculation constants
- Update `src/state/mod.rs` to export the new module

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
```

## Security Features

- **Admin-only Operations**: Collection creation and NFT minting restricted to authorized admins
- **PDA-based Vaults**: Secure program-derived addresses for asset storage
- **Permission Validation**: Comprehensive access control for all operations
- **Account Cleanup**: Automatic account closure to prevent rent waste
- **State Verification**: Extensive validation of account states and transitions

## License

This project is licensed under the terms specified in the LICENSE file.

## About Ascendry.io

[Ascendry.io](https://ascendry.io) is a comprehensive platform for managing digital assets and loans on the Solana blockchain. This vault package is a core component of Ascendry's infrastructure, enabling secure and efficient management of NFT collections, asset redemptions, and loan operations.

For more information about Ascendry.io, visit our [website](https://ascendry.io) or contact us at [rastaar@ascendry.io](mailto:rastaar@ascendry.io). 