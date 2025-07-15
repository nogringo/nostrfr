import 'dotenv/config';
import NDK, { NDKPrivateKeySigner, NDKKind, NDKEvent } from "@nostr-dev-kit/ndk";
import { appId, onlyFrPubkeys, relays } from "./config.js";
import { isFrench } from './src/is_french.js';
import { addBookmark } from './src/add_bookmark.js';
import pino from 'pino';

const logger = pino();

const skHex = process.env.SK_HEX;
const signer = new NDKPrivateKeySigner(skHex);

const ndk = new NDK({
    signer,
    explicitRelayUrls: relays,
});

await ndk.connect();

const user = ndk.activeUser;

let follows = await ndk.activeUser.followSet();

const repostedEvents = await ndk.fetchEvents({
    kinds: [NDKKind.Repost],
    authors: [user.pubkey],
    limit: 200,
});
let repostedEventsId = Array.from(repostedEvents).map((e) => ["e", e.tags.find(tag => tag[0] == "e")[1]]);

const followSub = ndk.subscribe({
    kinds: [NDKKind.Contacts],
    authors: [user.pubkey],
    since: Math.floor(Date.now() / 1000),
});
followSub.on("event", async () => {
    logger.info("onFollow");
    follows = await ndk.activeUser.followSet();
});

const repostSub = ndk.subscribe({
    kinds: [NDKKind.Repost],
    authors: [user.pubkey],
    since: Math.floor(Date.now() / 1000),
});
repostSub.on("event", (event) => {
    logger.info("onRepost");

    const repostedEventId = event.tags.find(tag => tag[0] == "e")[1];
    repostedEventsId.unshift(["e", repostedEventId]);
    repostedEventsId = repostedEventsId.slice(0, 200);
});

const dvmSub = ndk.subscribe({
    kinds: [NDKKind.DVMReqDiscoveryNostrContent],
    since: Math.floor(Date.now() / 1000),
    "#p": [user.pubkey],
});
dvmSub.on("event", (event) => {
    logger.info("onDvmRequest");
    const stringifyedConted = JSON.stringify(repostedEventsId);

    const res = new NDKEvent(ndk, {
        kind: 6300,
        content: stringifyedConted,
        tags: [
            ["request", event.serialize(true, true)],
            ["e", event.id],
            ["p", event.pubkey],
            ["alt", "This is the result of a NIP90 DVM AI task with kind 5300. The task was: "],
            ["status", "success"],
        ],
    });

    res.publish();
});

const allEventSub = ndk.subscribe({
    kinds: [NDKKind.Text],
    since: Math.floor(Date.now() / 1000),
});
allEventSub.on("event", (event) => {
    if (ndk.mutedIds.has(event.author.pubkey)) return;

    const stringifyedEvent = event.serialize();
    const isFollow = follows.has(event.author.pubkey);

    if (event.content == appId) {
        logger.info("Secret string detected");
        return;
    }

    async function addNote() {
        logger.info("Add note");
        if (isFollow) event.repost();
        else addBookmark(ndk, event.id);
    }

    // if (onlyFrPubkeys.includes(event.pubkey)) {
    //     logger.info("Detected onlyFrPubkeys");
    //     addNote();
    //     return;
    // }

    const nostrfrRegex = /#nostrfr(\W|$)/;
    const isNostrfr = nostrfrRegex.test(event.content);
    if (isNostrfr) {
        addNote();
        return;
    }

    if (isFollow) {
        if (isFrench(event.content)) {
            event.repost();
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
});

logger.info("Started");
