import 'dotenv/config';
import NDK, { NDKPrivateKeySigner, NDKEvent } from "@nostr-dev-kit/ndk";
import { relays, appId } from "./config.js";
import pino from 'pino';

const logger = pino();

const skHex = process.env.SK_HEX;
const signer = new NDKPrivateKeySigner(skHex);

const ndk = new NDK({
    signer,
    explicitRelayUrls: relays,
});

await ndk.connect(1000);

const user = ndk.activeUser;

// DVM service announcement content
const dvmInfo = {
    name: "Nostrfr",
    picture: "https://blossom.primal.net/1a6c92d636515dee736b7b95b36dbcca460b0d526590bfc4f52b7fcec37955d4.png",
    about: "Je montre les dernières notes en Français",
    lud16: "Nostrfr@coinos.io",
    supportsEncryption: false,
    acceptsNutZaps: true,
    personalized: false,
    amount: "free",
    nip90Params: {}
};

// Create DVM announcement event (kind 31990)
const dvmAnnouncement = new NDKEvent(ndk, {
    kind: 31990,
    content: JSON.stringify(dvmInfo),
    tags: [
        ["k", "5300"],  // Kind 5300 for content discovery
        ["d", appId],  // Unique identifier for this DVM from config
    ],
});

logger.info(`Announcing DVM service from ${user.pubkey}`);
await dvmAnnouncement.publish();
logger.info(`DVM announcement sent with ID: ${dvmAnnouncement.id}`);

setTimeout(() => {
    logger.info("Exiting...");
    process.exit(0);
}, 5000);