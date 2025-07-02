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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const core_1 = require("@hpke/core");
const dhkem_x25519_1 = require("@hpke/dhkem-x25519");
const chacha20poly1305_1 = require("@hpke/chacha20poly1305");
const fs = __importStar(require("fs"));
const ethers_1 = require("ethers");
const suite = new core_1.CipherSuite({
    kem: new dhkem_x25519_1.DhkemX25519HkdfSha256(),
    kdf: new core_1.HkdfSha256(),
    aead: new chacha20poly1305_1.Chacha20Poly1305(),
});
function arrayBufferToBase64url(buf) {
    return Buffer.from(buf).toString('base64url');
}
function arrayBufferToBase64(buf) {
    return Buffer.from(buf).toString('base64');
}
function base64ToUint8Array(b64) {
    return new Uint8Array(Buffer.from(b64, 'base64'));
}
let recipientPrivKey;
let recipientPubKey;
(async () => {
    const rkp = await suite.kem.generateKeyPair();
    recipientPrivKey = rkp.privateKey;
    recipientPubKey = rkp.publicKey;
    const pubKeyBuf = await suite.kem.serializePublicKey(rkp.publicKey);
    const privKeyBuf = await suite.kem.serializePrivateKey(rkp.privateKey);
    const pubKey = arrayBufferToBase64url(pubKeyBuf);
    const privKey = arrayBufferToBase64url(privKeyBuf);
    fs.writeFileSync('.hpke-secret', privKey);
    fs.writeFileSync('../../../frontend-V1/public/hpke-key.txt', pubKey);
    console.log('HPKE keypair generated & saved.');
})();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '512kb' }));
app.post('/submit', async (req, res) => {
    try {
        console.log("the request is ", req.body);
        const { enc, ctc } = req.body;
        console.log("enc is ", enc);
        console.log("ctc is ", ctc);
        const encBuf = Buffer.from(enc, 'base64'); // or base64url
        const encArrayBuffer = encBuf.buffer.slice(encBuf.byteOffset, encBuf.byteOffset + encBuf.byteLength);
        console.log("encArrayBuffer is ", encArrayBuffer);
        const ctBuf = Buffer.from(ctc, 'base64');
        const ctArrayBuffer = ctBuf.buffer.slice(ctBuf.byteOffset, ctBuf.byteOffset + ctBuf.byteLength);
        console.log("ctArrayBuffer is ", ctArrayBuffer);
        if (!recipientPrivKey)
            throw new Error('HPKE private key not loaded!');
        //try
        // const sender= await suite.createSenderContext({
        //   recipientPublicKey: recipientPubKey
        // })
        // HPKE Decrypt
        const recipient = await suite.createRecipientContext({
            recipientKey: recipientPrivKey,
            enc: encArrayBuffer,
        });
        //  const ct = await sender.seal(new TextEncoder().encode("Hello world!"));
        const pt = await recipient.open(ctArrayBuffer);
        console.log(new TextDecoder().decode(pt));
        // const pt = await recipient.open(ctBytes);
        const textFetched = new TextDecoder().decode(pt);
        console.log('Decrypted payload (JSON):', textFetched);
        const { payload, sig } = JSON.parse(textFetched);
        const recovered = (0, ethers_1.verifyMessage)(JSON.stringify(payload), sig);
        if (recovered.toLowerCase() !== payload.trader.toLowerCase()) {
            throw new Error('bad signature');
        }
        console.log('✅ Burner wallet + HPKE worked! Trade:', payload);
        res.json({ ok: true });
    }
    catch (e) {
        console.error('❌ Error:', e);
        res.status(400).json({ error: 'decrypt, parse, or sig failed' });
    }
});
app.listen(8080, () => console.log('🟢 Listening on :8080'));
