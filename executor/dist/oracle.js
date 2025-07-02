"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrice = getPrice;
const ethers_1 = require("ethers");
const provider = new ethers_1.JsonRpcProvider(process.env.RPC_URL);
const feeds = {
    0: '0xFeedAddressTSLA', // TSLA / USD (Chainlink Fuji)
    1: '0xFeedAddressAAPL' // AAPL / USD
};
const abi = ['function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)'];
async function getPrice(assetId) {
    const feed = new ethers_1.Contract(feeds[assetId], abi, provider);
    const [, price] = await feed.latestRoundData();
    return BigInt(price); // 1e8
}
