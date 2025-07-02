"use strict";
// import {recomputeRoot, Leaf } from './tree.js'; 
// import { proveAndLiquidate } from './proof.js'; 
// import { receiver } from './contracts.js'; 
// import { getPrice } from './oracle.js'; 
// export interface Trade { 
// trader: string; 
// assetId: number; 
// qty:    bigint; 
// margin: bigint; 
// } 
// const leaves  = new Map<string, Leaf>(); 
// const nets: Record<number, { qty: bigint; margin: bigint }> = {}; 
// let   flushTimer: NodeJS.Timeout | null = null; 
// const FLUSH_MS = 5000; 
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTradeToBatch = addTradeToBatch;
// export async function addTradeToBatch(t: Trade) { 
//   const key = `${t.trader}-${t.assetId}`; 
//   const leaf = leaves.get(key) ?? { size: 0n, margin: 0n, entryFunding: 0n }; 
//   leaf.size   += t.qty; 
//   leaf.margin += t.margin; 
//   leaves.set(key, leaf); 
//   const n = nets[t.assetId] || { qty: 0n, margin: 0n }; 
//   n.qty    += t.qty; 
//   n.margin += t.margin; 
//   nets[t.assetId] = n; 
//   if (!flushTimer) flushTimer = setTimeout(flushBatch, FLUSH_MS); 
// } 
// async function flushBatch() { 
//   flushTimer = null; 
//   const root = recomputeRoot(leaves); 
//   // quick liquidation check (placeholder) 
//   for (const key of leaves.keys()) { 
//     const [trader, assetId] = key.split('-'); 
//     await proveAndLiquidate(trader, Number(assetId), await getPrice(Number(assetId)), root); 
//   } 
//   // send net exposure 
//   for (const [idStr, agg] of Object.entries(nets)) { 
//     if (agg.qty !== 0n || agg.margin !== 0n) { 
//       await receiver.tradeNet(Number(idStr), agg.qty, agg.margin, { gasLimit: 300_000 }); 
//       nets[Number(idStr)] = { qty: 0n, margin: 0n }; 
//     } 
//   } 
// }
const tree_1 = require("./tree");
const proof_js_1 = require("./proof.js");
const oracle_1 = require("./oracle");
const ethers_1 = require("ethers");
const PerpEngineZK_json_1 = __importDefault(require("./abis/PerpEngineZK.json"));
const provider = new ethers_1.ethers.JsonRpcProvider("http://localhost:8545"); // or your RPC
const signer = provider.getSigner(); // or some wallet
const perpZK = new ethers_1.ethers.Contract("0xYOUR_CONTRACT_ADDRESS", PerpEngineZK_json_1.default, signer);
const leaves = new Map();
const nets = {};
let flushTimer = null;
const FLUSH_MS = 5000;
/* add trade */
async function addTradeToBatch(t) {
    const key = `${t.trader}-${t.assetId}`;
    const leaf = leaves.get(key) ?? { size: 0n, margin: 0n, entryFunding: 0n };
    leaf.size += t.qty;
    leaf.margin += t.margin;
    leaves.set(key, leaf);
    (0, tree_1.upsert)(key, leaf); // ◀ O(log n)
    const n = nets[t.assetId] || { qty: 0n, margin: 0n };
    n.qty += t.qty;
    n.margin += t.margin;
    nets[t.assetId] = n;
    if (!flushTimer)
        flushTimer = setTimeout(flushBatch, FLUSH_MS);
}
/* flush */
async function flushBatch() {
    flushTimer = null;
    const root = (0, tree_1.currentRoot)();
    for (const [key, leaf] of leaves) {
        const [trader, assetIdStr] = key.split('-');
        const assetId = Number(assetIdStr);
        // TODO: quick MCR check before proving
        await (0, proof_js_1.proveAndLiquidate)(trader, assetId, await (0, oracle_1.getPrice)(assetId), root, leaf);
    }
    for (const [idStr, agg] of Object.entries(nets)) {
        if (agg.qty !== 0n || agg.margin !== 0n) {
            await perpZK.tradeNet(Number(idStr), agg.qty, agg.margin, { gasLimit: 300000 });
            nets[Number(idStr)] = { qty: 0n, margin: 0n };
        }
    }
}
