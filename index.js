import 'dotenv/config';
import NDK, { NDKPrivateKeySigner, NDKKind, NDKEvent } from "@nostr-dev-kit/ndk";
import { appId, relays } from "./config.js";
import { isFrench } from './src/is_french.js';
import { addBookmark } from './src/add_bookmark.js';
import pino from 'pino';

const logger = pino();

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const skHex = process.env.SK_HEX;
const signer = new NDKPrivateKeySigner(skHex);

const ndk = new NDK({
    signer,
    explicitRelayUrls: relays,
});

await ndk.connect(1000).catch(err => {
    logger.error("Failed to connect to relays:", err);
    process.exit(1);
});

const user = ndk.activeUser;

let follows;
try {
    follows = await ndk.activeUser.followSet();
} catch (err) {
    logger.error("Failed to fetch initial follow set:", err);
    follows = new Set();
}

let repostedEventsId = [];
try {
    const repostedEvents = await ndk.fetchEvents({
        kinds: [NDKKind.Repost],
        authors: [user.pubkey],
        limit: 200,
    });
    repostedEventsId = Array.from(repostedEvents)
        .sort((a, b) => b.created_at - a.created_at)
        .map((e) => {
            const eTag = e.tags.find(tag => tag[0] == "e");
            return eTag ? ["e", eTag[1]] : null;
        })
        .filter(Boolean);
} catch (err) {
    logger.error("Failed to fetch initial reposts:", err);
}

const followSub = ndk.subscribe({
    kinds: [NDKKind.Contacts],
    authors: [user.pubkey],
    since: Math.floor(Date.now() / 1000),
});
followSub.on("event", async () => {
    try {
        logger.info("onFollow");
        follows = await ndk.activeUser.followSet();
    } catch (err) {
        logger.error("Error updating follow set:", err);
    }
});

const repostSub = ndk.subscribe({
    kinds: [NDKKind.Repost],
    authors: [user.pubkey],
    since: Math.floor(Date.now() / 1000),
});
repostSub.on("event", (event) => {
    try {
        logger.info("onRepost");

        const eTag = event.tags.find(tag => tag[0] == "e");
        if (!eTag) {
            logger.warn("Repost event missing e tag");
            return;
        }
        const repostedEventId = eTag[1];
        repostedEventsId.unshift(["e", repostedEventId]);
        repostedEventsId = repostedEventsId.slice(0, 200);
    } catch (err) {
        logger.error("Error handling repost event:", err);
    }
});

const dvmSub = ndk.subscribe({
    kinds: [NDKKind.DVMReqDiscoveryNostrContent],
    since: Math.floor(Date.now() / 1000),
    "#p": [user.pubkey],
});
dvmSub.on("event", async (event) => {
    try {
        logger.info("onDvmRequest");
        const stringifyedContent = JSON.stringify(repostedEventsId);

        const res = new NDKEvent(ndk, {
            kind: 6300,
            content: stringifyedContent,
            tags: [
                ["request", event.serialize(true, true)],
                ["e", event.id],
                ["p", event.pubkey],
                ["alt", "This is the result of a NIP90 DVM AI task with kind 5300. The task was: "],
                ["status", "success"],
            ],
        });

        await res.publish();
        logger.info("DVM response published successfully");
    } catch (err) {
        logger.error("Error handling DVM request:", err);
    }
});

const allEventSub = ndk.subscribe({
    kinds: [NDKKind.Text],
    since: Math.floor(Date.now() / 1000),
});
allEventSub.on("event", async (event) => {
    try {
        if (ndk.mutedIds?.has(event.author.pubkey)) return;

        const stringifyedEvent = event.serialize();
        const isFollow = follows.has(event.pubkey);

        if (event.content == appId) {
            logger.info("Secret string detected");
            return;
        }

        async function addNote() {
            logger.info("Add note");
            try {
                if (isFollow) await event.repost();
                else await addBookmark(ndk, event.id);
            } catch (err) {
                logger.error("Failed to add note:", err);
            }
        }

        // if (onlyFrPubkeys.includes(event.pubkey)) {
        //     logger.info("Detected onlyFrPubkeys");
        //     addNote();
        //     return;
        // }

        const nostrfrRegex = /#nostrfr(\W|$)/;
        const isNostrfr = nostrfrRegex.test(event.content);
        if (isNostrfr) {
            await addNote();
            return;
        }

        if (isFollow) {
            if (isFrench(event.content)) {
                event.repost().catch(err => logger.error("Failed to repost:", err));
                return;
            }
        }
        else {
            const isMostr = stringifyedEvent.includes("mostr.pub");
            if (isMostr) return;

            const isRssFeed = event.tags.some(tag => tag[0] == "proxy" && tag[2] == "rss");
            if (isRssFeed) return;

            if (isFrench(event.content, 0.16)) addBookmark(ndk, event.id);
        }
    } catch (err) {
        logger.error("Error handling text event:", err);
    }
});

logger.info("Started");
