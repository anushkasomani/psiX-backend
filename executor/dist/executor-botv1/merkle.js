"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merkleTree = exports.PoseidonMerkleTree = void 0;
const imt_1 = require("@zk-kit/imt");
const poseidon_lite_1 = require("poseidon-lite");
const database_1 = require("./database");
class PoseidonMerkleTree {
    constructor() {
        this.TREE_DEPTH = 20; // Support up to 2^20 = ~1M positions
        this.ZERO_VALUE = BigInt(0);
        this.ARITY = 2; // Binary tree
        // Map to track position hash to leaf index
        this.positionToIndex = new Map();
        console.log('🌳 Initializing Poseidon Merkle Tree...');
        // Initialize IMT with poseidon2 for binary tree hashing
        this.tree = new imt_1.IMT(poseidon_lite_1.poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
        // Restore state from database if exists
        this.restoreFromDatabase();
        console.log('✅ Poseidon Merkle Tree initialized');
        console.log(`🌳 Current root: ${this.getCurrentRootHex()}`);
    }
    // ====================================================================
    // POSITION MANAGEMENT
    // ====================================================================
    /**
     * Add or update a position in the merkle tree
     */
    updatePosition(position) {
        console.log(`🌳 Updating position: ${position.trader} asset ${position.assetId}`);
        const positionHash = this.hashPosition(position);
        const positionKey = `${position.trader.toLowerCase()}-${position.assetId}`;
        // Check if position already exists
        const existingIndex = this.positionToIndex.get(positionKey);
        if (existingIndex !== undefined) {
            // Update existing position
            this.tree.update(existingIndex, positionHash);
            console.log(`🔄 Updated existing position at index ${existingIndex}`);
        }
        else {
            // Insert new position
            this.tree.insert(positionHash);
            const newIndex = this.tree.leaves.length - 1;
            this.positionToIndex.set(positionKey, newIndex);
            console.log(`✅ Inserted new position at index ${newIndex}`);
        }
        // Save to database
        database_1.database.savePosition(position);
        console.log(`🌳 New root: ${this.getCurrentRootHex()}`);
    }
    /**
     * Remove a position from the merkle tree
     */
    removePosition(trader, assetId) {
        const positionKey = `${trader.toLowerCase()}-${assetId}`;
        const index = this.positionToIndex.get(positionKey);
        if (index === undefined) {
            console.log(`❌ Position not found: ${positionKey}`);
            return false;
        }
        // Update to zero (effectively removing)
        this.tree.update(index, this.ZERO_VALUE);
        this.positionToIndex.delete(positionKey);
        console.log(`🗑️ Removed position: ${positionKey} at index ${index}`);
        console.log(`🌳 New root: ${this.getCurrentRootHex()}`);
        return true;
    }
    // ====================================================================
    // MERKLE TREE OPERATIONS
    // ====================================================================
    /**
     * Get current merkle root
     */
    getCurrentRoot() {
        return this.toBigInt(this.tree.root);
    }
    /**
     * Get current merkle root as hex string
     */
    getCurrentRootHex() {
        const root = this.getCurrentRoot();
        return `0x${root.toString(16).padStart(64, '0')}`;
    }
    /**
     * Generate merkle proof for a position
     */
    generateProof(trader, assetId) {
        const positionKey = `${trader.toLowerCase()}-${assetId}`;
        const leafIndex = this.positionToIndex.get(positionKey);
        if (leafIndex === undefined) {
            console.log(`❌ Position not found for proof: ${positionKey}`);
            return null;
        }
        try {
            const proof = this.tree.createProof(leafIndex);
            return {
                root: this.toBigInt(proof.root),
                leaf: this.toBigInt(proof.leaf),
                siblings: proof.siblings.map(s => this.toBigInt(s)),
                pathIndices: proof.pathIndices,
                leafIndex: leafIndex
            };
        }
        catch (error) {
            console.error(`❌ Failed to generate proof for ${positionKey}:`, error);
            return null;
        }
    }
    /**
     * Verify a merkle proof
     */
    verifyProof(proof) {
        try {
            const imtProof = {
                root: proof.root,
                leaf: proof.leaf,
                siblings: proof.siblings,
                pathIndices: proof.pathIndices,
                leafIndex: proof.leafIndex
            };
            return this.tree.verifyProof(imtProof);
        }
        catch (error) {
            console.error('❌ Proof verification failed:', error);
            return false;
        }
    }
    // ====================================================================
    // BATCH OPERATIONS
    // ====================================================================
    /**
     * Update multiple positions in batch
     */
    batchUpdatePositions(positions) {
        console.log(`🌳 Batch updating ${positions.length} positions...`);
        const oldRoot = this.getCurrentRoot();
        for (const position of positions) {
            this.updatePosition(position);
        }
        const newRoot = this.getCurrentRoot();
        console.log(`🌳 Batch complete: ${oldRoot.toString()} → ${newRoot.toString()}`);
        return { oldRoot, newRoot };
    }
    /**
     * Create checkpoint for rollback
     */
    createCheckpoint() {
        console.log('📸 Creating merkle tree checkpoint...');
        return {
            root: this.getCurrentRoot(),
            positionMap: new Map(this.positionToIndex),
            timestamp: Date.now()
        };
    }
    /**
     * Restore from checkpoint
     */
    restoreFromCheckpoint(checkpoint) {
        console.log('🔄 Restoring from checkpoint...');
        try {
            // Rebuild tree from database positions
            this.rebuildFromDatabase();
            // Restore position mapping
            this.positionToIndex = new Map(checkpoint.positionMap);
            console.log(`✅ Restored to checkpoint root: ${this.getCurrentRootHex()}`);
        }
        catch (error) {
            console.error('❌ Failed to restore from checkpoint:', error);
            throw error;
        }
    }
    // ====================================================================
    // POSITION HASHING
    // ====================================================================
    /**
     * Hash position data using Poseidon (iterative approach with poseidon2)
     */
    hashPosition(position) {
        try {
            // Convert trader address properly
            const traderHex = position.trader.replace('0x', '');
            const traderBigInt = BigInt('0x' + traderHex);
            // Hash fields using poseidon2 iteratively to combine all 6 fields
            // First combine trader and assetId
            const hash1 = (0, poseidon_lite_1.poseidon2)([traderBigInt, BigInt(position.assetId)]);
            // Then combine with size and margin  
            const hash2 = (0, poseidon_lite_1.poseidon2)([hash1, position.size]);
            const hash3 = (0, poseidon_lite_1.poseidon2)([hash2, position.margin]);
            // Finally combine with entryPrice and lastUpdate
            const hash4 = (0, poseidon_lite_1.poseidon2)([hash3, position.entryPrice]);
            const finalHash = (0, poseidon_lite_1.poseidon2)([hash4, BigInt(position.lastUpdate)]);
            return finalHash;
        }
        catch (error) {
            console.error('❌ Error hashing position:', error);
            console.error('Position data:', JSON.stringify(position, (key, value) => typeof value === 'bigint' ? value.toString() : value));
            throw error;
        }
    }
    /**
     * Calculate position hash for external use
     */
    calculatePositionHash(position) {
        return this.hashPosition(position);
    }
    // ====================================================================
    // DATABASE INTEGRATION
    // ====================================================================
    /**
     * Rebuild tree from database positions
     */
    rebuildFromDatabase() {
        console.log('🔄 Rebuilding merkle tree from database...');
        // Create new tree
        this.tree = new imt_1.IMT(poseidon_lite_1.poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
        this.positionToIndex.clear();
        // Get all positions from database
        const allPositions = database_1.database.getAllPositions();
        // Insert all position hashes
        for (const position of allPositions) {
            const positionHash = this.hashPosition(position);
            this.tree.insert(positionHash);
            const positionKey = `${position.trader.toLowerCase()}-${position.assetId}`;
            const index = this.tree.leaves.length - 1;
            this.positionToIndex.set(positionKey, index);
        }
        console.log(`✅ Tree rebuilt with ${allPositions.length} positions`);
    }
    /**
     * Restore state from database on startup
     */
    restoreFromDatabase() {
        try {
            console.log('📥 Restoring merkle state from database...');
            const allPositions = database_1.database.getAllPositions();
            if (allPositions.length === 0) {
                console.log('📝 No positions found, starting with empty tree');
                return;
            }
            // Rebuild tree from stored positions
            this.rebuildFromDatabase();
            console.log('✅ Merkle state restored from database');
        }
        catch (error) {
            console.log('📝 No existing merkle state found, starting fresh');
        }
    }
    // ====================================================================
    // UTILITIES
    // ====================================================================
    /**
     * Convert tree node to bigint
     */
    toBigInt(node) {
        if (typeof node === 'bigint')
            return node;
        if (typeof node === 'string')
            return BigInt(node);
        if (typeof node === 'number')
            return BigInt(node);
        throw new Error(`Cannot convert ${typeof node} to bigint`);
    }
    /**
     * Get tree statistics
     */
    getStats() {
        return {
            totalPositions: database_1.database.getAllPositions().length,
            currentRoot: this.getCurrentRootHex(),
            treeDepth: this.TREE_DEPTH,
            leafCount: this.tree.leaves.length,
            positionMappings: this.positionToIndex.size
        };
    }
    /**
     * Get all current leaves
     */
    getAllLeaves() {
        return this.tree.leaves.map(leaf => this.toBigInt(leaf));
    }
    /**
     * Find position by hash
     */
    findPositionByHash(hash) {
        // Check if hash exists in tree
        const leaves = this.getAllLeaves();
        const index = leaves.findIndex(leaf => leaf === hash);
        if (index === -1)
            return null;
        // Find the position that generates this hash
        const allPositions = database_1.database.getAllPositions();
        for (const position of allPositions) {
            if (this.hashPosition(position) === hash) {
                return { position, index };
            }
        }
        return null;
    }
    /**
     * Verify tree integrity
     */
    verifyIntegrity() {
        try {
            const allPositions = database_1.database.getAllPositions();
            console.log(`🔍 Verifying tree integrity for ${allPositions.length} positions...`);
            // Create temporary tree for comparison
            const tempTree = new imt_1.IMT(poseidon_lite_1.poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
            for (const position of allPositions) {
                const hash = this.hashPosition(position);
                tempTree.insert(hash);
            }
            const currentRoot = this.getCurrentRoot();
            const tempRoot = this.toBigInt(tempTree.root);
            const matches = tempRoot === currentRoot;
            if (matches) {
                console.log('✅ Tree integrity check passed');
            }
            else {
                console.error(`❌ Tree integrity check failed: expected ${tempRoot.toString()}, got ${currentRoot.toString()}`);
            }
            return matches;
        }
        catch (error) {
            console.error('❌ Tree integrity check failed:', error);
            return false;
        }
    }
    /**
     * Clear tree (for testing)
     */
    clear() {
        this.tree = new imt_1.IMT(poseidon_lite_1.poseidon2, this.TREE_DEPTH, this.ZERO_VALUE, this.ARITY);
        this.positionToIndex.clear();
        console.log('🧹 Merkle tree cleared');
    }
    /**
     * Get position index
     */
    getPositionIndex(trader, assetId) {
        const positionKey = `${trader.toLowerCase()}-${assetId}`;
        return this.positionToIndex.get(positionKey) ?? null;
    }
    /**
     * Check if position exists in tree
     */
    hasPosition(trader, assetId) {
        return this.getPositionIndex(trader, assetId) !== null;
    }
    /**
     * Get position count
     */
    getPositionCount() {
        return this.positionToIndex.size;
    }
    /**
     * Export tree state for backup
     */
    exportState() {
        return {
            root: this.getCurrentRootHex(),
            leaves: this.getAllLeaves().map(leaf => leaf.toString()),
            positionMap: Object.fromEntries(this.positionToIndex),
            timestamp: Date.now()
        };
    }
    /**
     * Import tree state from backup
     */
    importState(state) {
        console.log('📥 Importing merkle tree state...');
        try {
            // Rebuild from database first to ensure consistency
            this.rebuildFromDatabase();
            // Restore position mapping
            this.positionToIndex = new Map(Object.entries(state.positionMap));
            console.log(`✅ Imported state from ${new Date(state.timestamp).toISOString()}`);
        }
        catch (error) {
            console.error('❌ Failed to import state:', error);
            throw error;
        }
    }
}
exports.PoseidonMerkleTree = PoseidonMerkleTree;
// Export singleton instance
exports.merkleTree = new PoseidonMerkleTree();
