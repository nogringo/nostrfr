import 'dotenv/config';
import NDK, { NDKPrivateKeySigner, NDKKind, NDKEvent } from "@nostr-dev-kit/ndk";
import { relays } from "./config.js";
import { isFrench } from './src/is_french.js';
import { addBookmark } from './src/add_bookmark.js';

const skHex = process.env.SK_HEX;
const signer = new NDKPrivateKeySigner(skHex);

const ndk = new NDK({
    signer,
    explicitRelayUrls: relays,
});

await ndk.connect();

const user = ndk.activeUser;

let follows = await ndk.activeUser.followSet();
let repostedEventsId = [];

const followSub = ndk.subscribe({
    kinds: [NDKKind.Contacts],
    authors: [user.pubkey],
    since: Math.floor(Date.now() / 1000),
});
followSub.on("event", async () => {
    follows = await ndk.activeUser.followSet();
});

const repostSub = ndk.subscribe({
    kinds: [NDKKind.DVMReqDiscoveryNostrContent],
    since: Math.floor(Date.now() / 1000),
});
repostSub.on("event", (event) => {
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
    const stringifyedEvent = event.serialize();

    async function addNote() {
        if (follows.has(event.author.pubkey)) event.repost();
        else addBookmark(ndk, event.id);
    }

    const nostrfrRegex = /#nostrfr(\W|$)/;
    const isNostrfr = nostrfrRegex.test(event.content);
    if (isNostrfr) addNote();

    const isRssFeed = event.tags.some(tag => tag[0] == "proxy" && tag[2] == "rss");
    if (isRssFeed) return;

    const isMostr = stringifyedEvent.includes("mostr.pub");
    if (isMostr) return;

    if (!isFrench(event.content)) return;

    addNote();
});
