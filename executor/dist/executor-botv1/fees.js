"use strict";
// ====================================================================
// MINIMAL FEE CALCULATOR FOR PERP EXECUTOR
// ====================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.feeCalculator = exports.FeeCalculator = void 0;
class FeeCalculator {
    constructor() {
        // Default fee configuration (can be updated from contract)
        this.config = {
            openFeeBps: 10, // 0.1%
            closeFeeBps: 10, // 0.1%
            borrowingRateAnnualBps: 1000, // 10% annual
            fundingRateBps: 0, // 0% initially
            lastUpdate: Date.now()
        };
        console.log('💰 Fee calculator initialized');
    }
    // ====================================================================
    // OPENING FEES
    // ====================================================================
    /**
     * Calculate opening fee for a new position
     */
    calculateOpeningFee(positionSizeUsd) {
        const fee = (positionSizeUsd * BigInt(this.config.openFeeBps)) / 10000n;
        console.log(`💰 Opening fee: ${this.formatUSDC(fee)} (${this.config.openFeeBps / 100}% of ${this.formatUSDC(positionSizeUsd)})`);
        return fee;
    }
    /**
     * Calculate closing fee for a position
     */
    calculateClosingFee(positionSizeUsd) {
        const fee = (positionSizeUsd * BigInt(this.config.closeFeeBps)) / 10000n;
        console.log(`💰 Closing fee: ${this.formatUSDC(fee)} (${this.config.closeFeeBps / 100}% of ${this.formatUSDC(positionSizeUsd)})`);
        return fee;
    }
    // ====================================================================
    // BORROWING FEES
    // ====================================================================
    /**
     * Calculate borrowing fee based on time elapsed
     */
    calculateBorrowingFee(positionSizeUsd, timeElapsedHours) {
        // Convert annual rate to hourly
        const hourlyRateBps = this.config.borrowingRateAnnualBps / (365 * 24);
        const fee = (positionSizeUsd * BigInt(Math.floor(hourlyRateBps * timeElapsedHours))) / 10000n;
        console.log(`💰 Borrowing fee: ${this.formatUSDC(fee)} (${timeElapsedHours}h at ${this.config.borrowingRateAnnualBps / 100}% annual)`);
        return fee;
    }
    // ====================================================================
    // FUNDING RATES
    // ====================================================================
    /**
     * Calculate funding fee for a position
     */
    calculateFundingFee(positionSizeUsd, isLong, fundingRateBps = this.config.fundingRateBps) {
        // Funding fee = position size * funding rate
        // Long pays positive funding, short receives it
        let fee = (positionSizeUsd * BigInt(Math.abs(fundingRateBps))) / 10000n;
        // If long position and positive funding rate, pay fee
        // If short position and positive funding rate, receive fee (negative)
        if (isLong && fundingRateBps > 0) {
            // Long pays
            console.log(`💰 Funding fee (LONG pays): ${this.formatUSDC(fee)}`);
            return fee;
        }
        else if (!isLong && fundingRateBps > 0) {
            // Short receives
            console.log(`💰 Funding fee (SHORT receives): -${this.formatUSDC(fee)}`);
            return -fee;
        }
        else if (isLong && fundingRateBps < 0) {
            // Long receives
            console.log(`💰 Funding fee (LONG receives): -${this.formatUSDC(fee)}`);
            return -fee;
        }
        else if (!isLong && fundingRateBps < 0) {
            // Short pays
            console.log(`💰 Funding fee (SHORT pays): ${this.formatUSDC(fee)}`);
            return fee;
        }
        return 0n; // No funding if rate is 0
    }
    /**
     * Update funding rate based on long/short imbalance
     */
    updateFundingRate(totalLongUsd, totalShortUsd, sensitivity = 100 // bps per 1% imbalance
    ) {
        const totalOI = totalLongUsd + totalShortUsd;
        if (totalOI === 0n) {
            this.config.fundingRateBps = 0;
            return;
        }
        // Calculate imbalance: (long - short) / total
        const imbalance = Number(totalLongUsd - totalShortUsd) / Number(totalOI);
        // Funding rate = imbalance * sensitivity
        this.config.fundingRateBps = Math.floor(imbalance * sensitivity);
        this.config.lastUpdate = Date.now();
        console.log(`📊 Funding rate updated: ${this.config.fundingRateBps / 100}% (imbalance: ${(imbalance * 100).toFixed(2)}%)`);
    }
    // ====================================================================
    // COMPREHENSIVE FEE CALCULATION
    // ====================================================================
    /**
     * Calculate all fees for opening a new position
     */
    calculateNewPositionFees(positionSizeUsd, marginAmount, isLong) {
        const openingFee = this.calculateOpeningFee(positionSizeUsd);
        const borrowingFee = 0n; // No borrowing fee on opening
        const fundingFee = 0n; // No funding fee on opening
        const totalFees = openingFee + borrowingFee + fundingFee;
        const netMargin = marginAmount - totalFees;
        if (netMargin < 0n) {
            throw new Error(`Insufficient margin to cover fees: ${this.formatUSDC(marginAmount)} < ${this.formatUSDC(totalFees)}`);
        }
        const breakdown = {
            openingFee,
            borrowingFee,
            fundingFee,
            totalFees,
            netMargin
        };
        console.log(`💰 Position fees breakdown:`);
        console.log(`   Opening: ${this.formatUSDC(openingFee)}`);
        console.log(`   Total: ${this.formatUSDC(totalFees)}`);
        console.log(`   Net margin: ${this.formatUSDC(netMargin)}`);
        return breakdown;
    }
    /**
     * Calculate fees for an existing position over time
     */
    calculateExistingPositionFees(positionSizeUsd, isLong, hoursElapsed) {
        const openingFee = 0n; // Already paid
        const borrowingFee = this.calculateBorrowingFee(positionSizeUsd, hoursElapsed);
        const fundingFee = this.calculateFundingFee(positionSizeUsd, isLong);
        const totalFees = openingFee + borrowingFee + fundingFee;
        return {
            openingFee,
            borrowingFee,
            fundingFee,
            totalFees,
            netMargin: -totalFees // Negative since these are costs
        };
    }
    // ====================================================================
    // BATCH FEE CALCULATIONS
    // ====================================================================
    /**
     * Calculate total fees for a batch of trades
     */
    calculateBatchFees(trades) {
        console.log(`💰 Calculating fees for batch of ${trades.length} trades...`);
        let totalFees = 0n;
        let totalNetMargin = 0n;
        const feesByTrade = [];
        for (const trade of trades) {
            const breakdown = this.calculateNewPositionFees(trade.positionSizeUsd, trade.marginAmount, trade.isLong);
            totalFees += breakdown.totalFees;
            totalNetMargin += breakdown.netMargin;
            feesByTrade.push(breakdown);
        }
        console.log(`💰 Batch totals: Fees=${this.formatUSDC(totalFees)}, Net margin=${this.formatUSDC(totalNetMargin)}`);
        return {
            totalFees,
            totalNetMargin,
            feesByTrade
        };
    }
    // ====================================================================
    // CONFIGURATION MANAGEMENT
    // ====================================================================
    /**
     * Update fee configuration (e.g., from contract)
     */
    updateFeeConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig,
            lastUpdate: Date.now()
        };
        console.log('💰 Fee config updated:', {
            openFee: `${this.config.openFeeBps / 100}%`,
            closeFee: `${this.config.closeFeeBps / 100}%`,
            borrowingRate: `${this.config.borrowingRateAnnualBps / 100}%`,
            fundingRate: `${this.config.fundingRateBps / 100}%`
        });
    }
    /**
     * Get current fee configuration
     */
    getFeeConfig() {
        return { ...this.config };
    }
    /**
     * Get current funding rate
     */
    getCurrentFundingRate() {
        return this.config.fundingRateBps;
    }
    // ====================================================================
    // VALIDATION
    // ====================================================================
    /**
     * Validate that margin covers minimum fees
     */
    validateMinimumMargin(margin, positionSize) {
        const minimumFees = this.calculateOpeningFee(positionSize);
        return margin > minimumFees;
    }
    /**
     * Calculate minimum margin required
     */
    calculateMinimumMargin(positionSize) {
        const openingFee = this.calculateOpeningFee(positionSize);
        // Add 1% buffer
        return openingFee + (openingFee / 100n);
    }
    // ====================================================================
    // UTILITIES
    // ====================================================================
    formatUSDC(amount) {
        return `$${(Number(amount) / 1e6).toFixed(2)}`;
    }
    /**
     * Get fee summary for display
     */
    getFeeSummary() {
        return {
            openingFee: `${this.config.openFeeBps / 100}%`,
            closingFee: `${this.config.closeFeeBps / 100}%`,
            borrowingRateAnnual: `${this.config.borrowingRateAnnualBps / 100}%`,
            currentFundingRate: `${this.config.fundingRateBps / 100}%`,
            lastUpdated: new Date(this.config.lastUpdate).toISOString()
        };
    }
    /**
     * Clear config (for testing)
     */
    reset() {
        this.config = {
            openFeeBps: 10,
            closeFeeBps: 10,
            borrowingRateAnnualBps: 1000,
            fundingRateBps: 0,
            lastUpdate: Date.now()
        };
        console.log('🧹 Fee calculator reset to defaults');
    }
}
exports.FeeCalculator = FeeCalculator;
// Export singleton instance
exports.feeCalculator = new FeeCalculator();
