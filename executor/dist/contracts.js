"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signer = exports.provider = exports.Asset = exports.usdcToken = exports.liquidityPool = exports.chainlinkManager = exports.perpEngineZK = exports.perpZK = void 0;
exports.getCurrentPrice = getCurrentPrice;
exports.getDexPrice = getDexPrice;
exports.getCurrentFunding = getCurrentFunding;
exports.checkAssetPaused = checkAssetPaused;
exports.getPoolUtilization = getPoolUtilization;
exports.getTotalLiquidity = getTotalLiquidity;
exports.getReservedLiquidity = getReservedLiquidity;
exports.getPosition = getPosition;
exports.getPositionPnL = getPositionPnL;
exports.getCollateralRatio = getCollateralRatio;
exports.getLeverage = getLeverage;
exports.getLiquidationPrice = getLiquidationPrice;
exports.getOpenInterest = getOpenInterest;
exports.getLongOpenInterestTokens = getLongOpenInterestTokens;
exports.getContractConfig = getContractConfig;
exports.approveToken = approveToken;
exports.transferToken = transferToken;
exports.getTokenBalance = getTokenBalance;
exports.getTokenAllowance = getTokenAllowance;
exports.isPositionLiquidatable = isPositionLiquidatable;
exports.liquidatePosition = liquidatePosition;
exports.openVaultHedge = openVaultHedge;
exports.closeVaultHedge = closeVaultHedge;
exports.getVaultHedgePosition = getVaultHedgePosition;
exports.setupEventListeners = setupEventListeners;
exports.formatUSDC = formatUSDC;
exports.formatPrice = formatPrice;
exports.formatLeverage = formatLeverage;
exports.formatBps = formatBps;
const ethers_1 = require("ethers");
const abis_1 = require("./abis");
// Setup provider and contract instances
const provider = new ethers_1.ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
exports.provider = provider;
const privateKey = process.env.EXECUTOR_PRIVATE_KEY || '0x' + '1'.repeat(64);
const signer = new ethers_1.ethers.Wallet(privateKey, provider);
exports.signer = signer;
// Main PerpEngine contract
exports.perpZK = new ethers_1.Contract(process.env.PERP_ENGINE_ADDRESS || '0x' + '0'.repeat(40), abis_1.PERP_ENGINE_ABI, signer);
// Privacy layer contract
exports.perpEngineZK = new ethers_1.Contract(process.env.PERP_ENGINE_ZK_ADDRESS || '0x' + '0'.repeat(40), abis_1.PERP_ENGINE_ZK_ABI, signer);
// ChainLinkManager for price feeds
exports.chainlinkManager = new ethers_1.Contract(process.env.CHAINLINK_MANAGER_ADDRESS || '0x' + '0'.repeat(40), abis_1.CHAINLINK_MANAGER_ABI, provider);
// Liquidity pool contract
exports.liquidityPool = new ethers_1.Contract(process.env.LIQUIDITY_POOL_ADDRESS || '0x' + '0'.repeat(40), abis_1.LIQUIDITY_POOL_ABI, signer);
// USDC token contract
exports.usdcToken = new ethers_1.Contract(process.env.USDC_ADDRESS || '0x' + '0'.repeat(40), abis_1.ERC20_ABI, signer);
// Asset enum matching the contract
var Asset;
(function (Asset) {
    Asset[Asset["TSLA"] = 0] = "TSLA";
    Asset[Asset["AAPL"] = 1] = "AAPL";
    Asset[Asset["MSFT"] = 2] = "MSFT";
    Asset[Asset["GOOGL"] = 3] = "GOOGL";
    Asset[Asset["AMZN"] = 4] = "AMZN";
})(Asset || (exports.Asset = Asset = {}));
// Helper functions for contract interaction
async function getCurrentPrice(assetId = 0) {
    try {
        const price = await exports.chainlinkManager.getPrice(assetId);
        return BigInt(price.toString());
    }
    catch (error) {
        console.warn('Failed to fetch oracle price, using fallback');
        return 2000n * 10n ** 18n; // $2000 fallback
    }
}
async function getDexPrice(assetId = 0) {
    try {
        const price = await exports.chainlinkManager.getDexPrice(assetId);
        return BigInt(price.toString());
    }
    catch (error) {
        console.warn('Failed to fetch DEX price, using fallback');
        return 2000n * 10n ** 18n; // $2000 fallback
    }
}
async function getCurrentFunding(assetId = 0) {
    try {
        const rate = await exports.perpZK.getFundingRate(assetId);
        return BigInt(rate.toString());
    }
    catch (error) {
        console.warn('Failed to fetch funding rate, using fallback');
        return 100n * 10n ** 15n; // 0.1% fallback
    }
}
async function checkAssetPaused(assetId) {
    try {
        return await exports.chainlinkManager.checkIfAssetIsPaused(assetId);
    }
    catch (error) {
        console.warn('Failed to check asset pause status');
        return false;
    }
}
async function getPoolUtilization() {
    try {
        const utilization = await exports.perpZK.getPoolUtilization();
        return BigInt(utilization.toString());
    }
    catch (error) {
        console.warn('Failed to fetch pool utilization');
        return 0n;
    }
}
async function getTotalLiquidity() {
    try {
        const liquidity = await exports.liquidityPool.totalLiquidity();
        return BigInt(liquidity.toString());
    }
    catch (error) {
        console.warn('Failed to fetch total liquidity');
        return 1000000n * 10n ** 6n; // 1M USDC fallback
    }
}
async function getReservedLiquidity() {
    try {
        const reserved = await exports.liquidityPool.reservedLiquidity();
        return BigInt(reserved.toString());
    }
    catch (error) {
        console.warn('Failed to fetch reserved liquidity');
        return 0n;
    }
}
// Position management helper functions
async function getPosition(trader, assetId) {
    try {
        const position = await exports.perpZK.getPosition(trader, assetId);
        // Check if position exists (sizeUsd > 0)
        if (position.sizeUsd.toString() === '0') {
            return null;
        }
        return {
            sizeUsd: BigInt(position.sizeUsd.toString()),
            collateral: BigInt(position.collateral.toString()),
            entryPrice: BigInt(position.entryPrice.toString()),
            entryFundingRate: BigInt(position.entryFundingRate.toString()),
            isLong: position.isLong,
            lastBorrowingUpdate: BigInt(position.lastBorrowingUpdate.toString())
        };
    }
    catch (error) {
        console.error(`Failed to fetch position for ${trader}, asset ${assetId}:`, error);
        return null;
    }
}
async function getPositionPnL(trader, assetId) {
    try {
        const pnl = await exports.perpZK.getPnL(assetId, trader);
        return BigInt(pnl.toString());
    }
    catch (error) {
        console.error(`Failed to fetch PnL for ${trader}, asset ${assetId}:`, error);
        return 0n;
    }
}
async function getCollateralRatio(trader, assetId) {
    try {
        const ratio = await exports.perpZK.getCollateralRatio(trader, assetId);
        return BigInt(ratio.toString());
    }
    catch (error) {
        console.error(`Failed to fetch collateral ratio for ${trader}, asset ${assetId}:`, error);
        return 0n;
    }
}
async function getLeverage(trader, assetId) {
    try {
        const leverage = await exports.perpZK.getLeverage(trader, assetId);
        return BigInt(leverage.toString());
    }
    catch (error) {
        console.error(`Failed to fetch leverage for ${trader}, asset ${assetId}:`, error);
        return 0n;
    }
}
async function getLiquidationPrice(trader, assetId) {
    try {
        const price = await exports.perpZK.getLiquidationPrice(trader, assetId);
        return BigInt(price.toString());
    }
    catch (error) {
        console.error(`Failed to fetch liquidation price for ${trader}, asset ${assetId}:`, error);
        return 0n;
    }
}
// Market data helper functions
async function getOpenInterest(assetId) {
    try {
        const [longUsd, shortUsd] = await exports.perpZK.getOpenInterest(assetId);
        return {
            longUsd: BigInt(longUsd.toString()),
            shortUsd: BigInt(shortUsd.toString())
        };
    }
    catch (error) {
        console.error(`Failed to fetch open interest for asset ${assetId}:`, error);
        return { longUsd: 0n, shortUsd: 0n };
    }
}
async function getLongOpenInterestTokens(assetId) {
    try {
        const longTokens = await exports.perpZK.getLongOI(assetId);
        return BigInt(longTokens.toString());
    }
    catch (error) {
        console.error(`Failed to fetch long OI tokens for asset ${assetId}:`, error);
        return 0n;
    }
}
// Configuration helper functions
async function getContractConfig() {
    try {
        const [fundingRateSensitivity, minCollateralRatioBps, maxUtilizationBps, openFeeBps, closeFeeBps, liquidationFeeBps, borrowingRateAnnualBps, isPaused] = await Promise.all([
            exports.perpZK.fundingRateSensitivity(),
            exports.perpZK.minCollateralRatioBps(),
            exports.perpZK.maxUtilizationBps(),
            exports.perpZK.openFeeBps(),
            exports.perpZK.closeFeeBps(),
            exports.perpZK.liquidationFeeBps(),
            exports.perpZK.borrowingRateAnnualBps(),
            exports.perpZK.isPaused()
        ]);
        return {
            fundingRateSensitivity: BigInt(fundingRateSensitivity.toString()),
            minCollateralRatioBps: BigInt(minCollateralRatioBps.toString()),
            maxUtilizationBps: BigInt(maxUtilizationBps.toString()),
            openFeeBps: BigInt(openFeeBps.toString()),
            closeFeeBps: BigInt(closeFeeBps.toString()),
            liquidationFeeBps: BigInt(liquidationFeeBps.toString()),
            borrowingRateAnnualBps: BigInt(borrowingRateAnnualBps.toString()),
            isPaused
        };
    }
    catch (error) {
        console.error('Failed to fetch contract config:', error);
        throw error;
    }
}
// Token management functions
async function approveToken(spender, amount) {
    try {
        const tx = await exports.usdcToken.approve(spender, amount);
        await tx.wait();
        console.log(`💰 Approved ${amount} USDC for ${spender}`);
    }
    catch (error) {
        console.error('Failed to approve token:', error);
        throw error;
    }
}
async function transferToken(to, amount) {
    try {
        const tx = await exports.usdcToken.transfer(to, amount);
        await tx.wait();
        console.log(`💰 Transferred ${amount} USDC to ${to}`);
    }
    catch (error) {
        console.error('Failed to transfer token:', error);
        throw error;
    }
}
async function getTokenBalance(account) {
    try {
        const balance = await exports.usdcToken.balanceOf(account);
        return BigInt(balance.toString());
    }
    catch (error) {
        console.error(`Failed to fetch token balance for ${account}:`, error);
        return 0n;
    }
}
async function getTokenAllowance(owner, spender) {
    try {
        const allowance = await exports.usdcToken.allowance(owner, spender);
        return BigInt(allowance.toString());
    }
    catch (error) {
        console.error(`Failed to fetch allowance for ${owner} -> ${spender}:`, error);
        return 0n;
    }
}
// Liquidation functions
async function isPositionLiquidatable(trader, assetId) {
    try {
        return await exports.perpZK.isLiquidatable(trader, assetId);
    }
    catch (error) {
        console.error(`Failed to check liquidation status for ${trader}, asset ${assetId}:`, error);
        return false;
    }
}
async function liquidatePosition(trader, assetId) {
    try {
        const tx = await exports.perpZK.liquidate(trader, assetId, { gasLimit: 600000 });
        const receipt = await tx.wait();
        console.log(`🔥 Liquidated ${trader} asset ${assetId}, gas used: ${receipt.gasUsed}`);
        return tx.hash;
    }
    catch (error) {
        console.error(`Failed to liquidate ${trader}, asset ${assetId}:`, error);
        throw error;
    }
}
// Vault hedge functions (for vault integration)
async function openVaultHedge(assetId, hedgeAmount) {
    try {
        const tx = await exports.perpZK.openVaultHedge(assetId, hedgeAmount, { gasLimit: 800000 });
        const receipt = await tx.wait();
        console.log(`🛡️ Opened vault hedge for asset ${assetId}, amount: ${hedgeAmount}`);
        return tx.hash;
    }
    catch (error) {
        console.error(`Failed to open vault hedge for asset ${assetId}:`, error);
        throw error;
    }
}
async function closeVaultHedge(assetId, redeemAmount) {
    try {
        const tx = await exports.perpZK.closeVaultHedge(assetId, redeemAmount, { gasLimit: 800000 });
        const receipt = await tx.wait();
        // Parse the return value from logs or call static function
        const actualReturn = 0n; // Would need to parse from transaction logs or use callStatic
        console.log(`🛡️ Closed vault hedge for asset ${assetId}, redeemed: ${redeemAmount}`);
        return { txHash: tx.hash, actualReturn };
    }
    catch (error) {
        console.error(`Failed to close vault hedge for asset ${assetId}:`, error);
        throw error;
    }
}
async function getVaultHedgePosition(assetId) {
    try {
        const position = await exports.perpZK.getVaultHedgePosition(assetId);
        if (!position.exists) {
            return null;
        }
        return {
            sizeUsd: BigInt(position.sizeUsd.toString()),
            collateral: BigInt(position.collateral.toString()),
            entryPrice: BigInt(position.entryPrice.toString()),
            currentPnL: BigInt(position.currentPnL.toString()),
            currentValue: BigInt(position.currentValue.toString()),
            exists: position.exists
        };
    }
    catch (error) {
        console.error(`Failed to fetch vault hedge position for asset ${assetId}:`, error);
        return null;
    }
}
// Event listeners for monitoring
function setupEventListeners(callback) {
    // Position events
    exports.perpZK.on('PositionOpened', (trader, asset, sizeUsd, collateralAmount, price, isLong, event) => {
        callback({
            type: 'PositionOpened',
            trader,
            asset: Number(asset),
            sizeUsd: BigInt(sizeUsd.toString()),
            collateralAmount: BigInt(collateralAmount.toString()),
            price: BigInt(price.toString()),
            isLong,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        });
    });
    exports.perpZK.on('PositionClosed', (trader, asset, sizeUsd, netReturn, pnl, event) => {
        callback({
            type: 'PositionClosed',
            trader,
            asset: Number(asset),
            sizeUsd: BigInt(sizeUsd.toString()),
            netReturn: BigInt(netReturn.toString()),
            pnl: BigInt(pnl.toString()),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        });
    });
    exports.perpZK.on('PositionLiquidated', (trader, asset, positionSize, penalty, event) => {
        callback({
            type: 'PositionLiquidated',
            trader,
            asset: Number(asset),
            positionSize: BigInt(positionSize.toString()),
            penalty: BigInt(penalty.toString()),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        });
    });
    // Funding events
    exports.perpZK.on('FundingUpdated', (asset, hourlyFundingRate, newCumulativeFundingRate, event) => {
        callback({
            type: 'FundingUpdated',
            asset: Number(asset),
            hourlyFundingRate: BigInt(hourlyFundingRate.toString()),
            newCumulativeFundingRate: BigInt(newCumulativeFundingRate.toString()),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        });
    });
    // Vault hedge events
    exports.perpZK.on('VaultHedgeOpened', (user, asset, amount, event) => {
        callback({
            type: 'VaultHedgeOpened',
            user,
            asset: Number(asset),
            amount: BigInt(amount.toString()),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        });
    });
    exports.perpZK.on('VaultHedgeClosed', (user, asset, amount, event) => {
        callback({
            type: 'VaultHedgeClosed',
            user,
            asset: Number(asset),
            amount: BigInt(amount.toString()),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        });
    });
}
// Utility functions
function formatUSDC(amount) {
    return (Number(amount) / 1e6).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function formatPrice(price) {
    return (Number(price) / 1e18).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
function formatLeverage(leverage) {
    return (Number(leverage) / 1e6).toFixed(2) + 'x';
}
function formatBps(bps) {
    return (Number(bps) / 100).toFixed(2) + '%';
}
