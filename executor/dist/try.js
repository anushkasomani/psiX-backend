"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@hpke/core");
const dhkem_x25519_1 = require("@hpke/dhkem-x25519");
const chacha20poly1305_1 = require("@hpke/chacha20poly1305");
async function doHpke() {
    const suite = new core_1.CipherSuite({
        kem: new dhkem_x25519_1.DhkemX25519HkdfSha256(),
        kdf: new core_1.HkdfSha256(),
        aead: new chacha20poly1305_1.Chacha20Poly1305(),
    });
    // Generate a keypair
    const rkp = await suite.kem.generateKeyPair();
    // Sender context (public key)
    const sender = await suite.createSenderContext({
        recipientPublicKey: rkp.publicKey,
    });
    // Recipient context (private key, encapsulated key)
    const recipient = await suite.createRecipientContext({
        recipientKey: rkp.privateKey,
        enc: sender.enc,
    });
    // Encrypt message
    const ct = await sender.seal(new TextEncoder().encode("Hello world!"));
    // Decrypt message
    const pt = await recipient.open(ct);
    console.log(new TextDecoder().decode(pt));
}
doHpke().catch(e => {
    console.error("failed:", e);
});
