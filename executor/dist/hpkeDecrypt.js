"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.hpkeDecrypt = hpkeDecrypt;
const core_1 = require("@hpke/core");
const dhkem_x25519_1 = require("@hpke/dhkem-x25519");
const chacha20poly1305_1 = require("@hpke/chacha20poly1305");
const suite = new core_1.CipherSuite({
    kem: new dhkem_x25519_1.DhkemX25519HkdfSha256(),
    kdf: new core_1.HkdfSha256(),
    aead: new chacha20poly1305_1.Chacha20Poly1305(),
});
const fs = __importStar(require("fs"));
const botSkB64 = fs.readFileSync('.hpke-secret', 'utf8');
const botSecretRaw = Buffer.from(botSkB64, 'base64');
async function hpkeDecrypt(encB64, ctB64) {
    const enc = new Uint8Array(Buffer.from(encB64, 'base64'));
    const ct = new Uint8Array(Buffer.from(ctB64, 'base64'));
    const botSecret = await suite.kem.importKey('raw', botSecretRaw, true);
    const params = { recipientKey: botSecret, enc };
    const ptBuffer = await suite.open(params, ct);
    return new Uint8Array(ptBuffer);
}
