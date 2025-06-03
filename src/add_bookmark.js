import { NDKKind, NDKEvent } from "@nostr-dev-kit/ndk";

export async function addBookmark(ndk, eventId) {
    const latestBookmarkEvent = await ndk.fetchEvent({
        kinds: [NDKKind.BookmarkList],
        authors: [ndk.activeUser.pubkey],
    });

    let tags = [];
    if (latestBookmarkEvent) {
        tags = [...latestBookmarkEvent.tags, ["e", eventId]];
    }

    const bookmarkEvent = new NDKEvent(ndk, {
        kind: NDKKind.BookmarkList,
        tags,
    });
    await bookmarkEvent.sign(ndk.activeUser.ndk.signer);

    bookmarkEvent.publishReplaceable();
}