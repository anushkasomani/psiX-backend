"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ethers_1 = require("ethers");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '512kb' }));
app.post('/verify', async (req, res) => {
    try {
        const { payload, sig } = req.body;
        if (!payload || !sig) {
            return res.status(400).json({ error: 'Missing payload or signature' });
        }
        const payloadJson = JSON.stringify(payload);
        const recovered = (0, ethers_1.verifyMessage)(payloadJson, sig);
        if (recovered.toLowerCase() !== payload.trader.toLowerCase()) {
            return res.status(400).json({ error: 'Signature does not match trader address' });
        }
        res.json({ success: true, trader: recovered });
    }
    catch (e) {
        console.error('❌ Error:', e);
        res.status(400).json({ error: 'sig failed' });
    }
});
app.listen(8090, () => console.log('🟢 Listening on :8090'));
