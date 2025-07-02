"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashLeaf = hashLeaf;
exports.currentRoot = currentRoot;
exports.insertPosition = insertPosition;
exports.deletePosition = deletePosition;
exports.getPathIndices = getPathIndices;
exports.getPathElements = getPathElements;
const imt_1 = require("@zk-kit/imt");
const poseidon_lite_1 = require("poseidon-lite");
// Use poseidon3 for leaf hash (3 fields)
function hashLeaf(l) {
    return (0, poseidon_lite_1.poseidon3)([l.size, l.margin, l.entryFunding]);
}
const leafLeft = { size: BigInt(3), margin: BigInt(-100), entryFunding: BigInt(5) };
const leafMid = { size: BigInt(4), margin: BigInt(120), entryFunding: BigInt(10) };
const leafRight = { size: BigInt(4), margin: BigInt(-120), entryFunding: BigInt(10) };
const zeroValue = BigInt(0);
const leftHash = hashLeaf(leafLeft);
const midHash = hashLeaf(leafMid);
const rightHash = hashLeaf(leafRight);
const depth = 10;
const arity = 2;
const leaves = [leftHash, midHash, rightHash];
// Use poseidon2 for the IMT hash function (arity=2)
const tree = new imt_1.IMT(poseidon_lite_1.poseidon2, depth, zeroValue, arity, leaves);
console.log("Tree is", tree);
console.log("Merkle root:", tree.root);
// const proof = tree.createProof(0);
// console.log("Proof valid:", tree.verifyProof(proof));
// console.log(tree.leaves)
// tree.insert(hashLeaf({size: BigInt(5), margin: BigInt(200), entryFunding: BigInt(15)}));
// console.log("New Merkle root after insertion:", tree.root);
// console.log("New Merkle leaves after insertion:", tree);
// tree.delete(2)
// console.log("New Merkle tree after deletion:", tree);
function currentRoot() {
    return tree.root;
}
function insertPosition(leaf) {
    tree.insert(hashLeaf(leaf));
    return tree.indexOf(hashLeaf(leaf));
}
function deletePosition(hash) {
    const index = tree.indexOf(hash);
    tree.delete(index);
}
// deletePosition(15215956860192754867003942406872706015577979927073229954434143459039467021244n)
// console.log(tree)
// const proof = tree.createProof(0)
// console.log("Proof:", proof);
function getPathIndices(index) {
    const proof = tree.createProof(index);
    return proof.pathIndices;
}
function getPathElements(index) {
    const proof = tree.createProof(index);
    const elements = proof.siblings;
    let pathElements = [];
    for (let i = 0; i < elements.length; i++) {
        pathElements.push(elements[i].toString());
    }
    return pathElements;
}
const elements = getPathElements(0);
console.log("Path Elements:", elements);
const indices = getPathIndices(0);
console.log("Path Indices:", indices);
