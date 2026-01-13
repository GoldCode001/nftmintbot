# NFT Mint Bot by goldman

A universal NFT minting bot that automatically detects contract types and executes mints across multiple blockchain networks.

## Features

- 🔍 **Automatic Contract Detection** - Detects SeaDrop, standard ERC721, and custom implementations
- 🌊 **SeaDrop Support** - Full support for OpenSea's SeaDrop protocol
- 🔗 **Multi-Chain** - Works on Ethereum, Polygon, Base, Arbitrum, and BSC
- 💰 **Smart Price Detection** - Automatically reads mint prices from contracts
- 🎯 **Multiple Fallback Methods** - Tries various mint functions if primary method fails
- 🔐 **Wallet Integration** - Supports all EIP-6963 compatible wallets

## Supported Chains

- Ethereum Mainnet
- Polygon
- Base
- Arbitrum One
- BNB Smart Chain

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/nft-mint-bot.git
cd nft-mint-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

4. Add your Etherscan API key to `.env`:
```
REACT_APP_ETHERSCAN_API_KEY=your_api_key_here
```

Get a free API key from [Etherscan](https://etherscan.io/apis).

## Usage

1. Start the development server:
```bash
npm start
```

2. Connect your wallet (MetaMask, Coinbase Wallet, etc.)

3. Select the blockchain network

4. Paste the NFT contract address

5. Click "Analyze" to detect contract type and mint functions

6. Set amount and click "Mint Now"

## How It Works

### Contract Detection

The bot automatically detects the contract type by:

1. **SeaDrop Detection** - Checks for `updateAllowedSeaDrop` function in the contract ABI
2. **ABI Analysis** - Fetches the full contract ABI from Etherscan API v2
3. **Function Discovery** - Identifies all payable mint functions
4. **Fallback Methods** - Has built-in fallback functions for common patterns

### SeaDrop Protocol

For SeaDrop contracts (OpenSea standard):
- Automatically uses the chain's SeaDrop contract address
- Calls `mintPublic(nftContract, feeRecipient, minter, quantity)`
- Handles OpenSea fee recipients correctly

### Standard Mints

For non-SeaDrop contracts:
- Tries detected mint functions from ABI
- Falls back to common patterns: `mint()`, `publicMint()`, `mintNFT()`
- Automatically handles different parameter requirements

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REACT_APP_ETHERSCAN_API_KEY` | Etherscan API key for fetching contract ABIs | Yes |

## Technologies Used

- React
- Web3.js
- Etherscan API v2
- EIP-6963 (Multi-wallet support)
- Tailwind CSS

## Deployment [if you want to]

### Vercel (Recommended)

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com) and sign in with GitHub
3. Import your repository
4. Add environment variable:
   - Key: `REACT_APP_ETHERSCAN_API_KEY`
   - Value: Your Etherscan API key
5. Deploy!

### Netlify

1. Push your code to GitHub
2. Go to [Netlify](https://netlify.com)
3. Import your repository
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `build`
5. Add environment variable in site settings
6. Deploy!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This tool is for educational purposes. Always verify contract details before minting. Use at your own risk.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ by goldman for the Web3 community
