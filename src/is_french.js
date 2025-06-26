import { detectAll } from 'tinyld';

export function isFrench(text) {
    text = text
        .split(' ')
        .filter((word) => !word.startsWith('#') && !word.startsWith('http') && !word.startsWith('nostr:npub'))
        .join(' ');

    try {
        const tinyldResult = detectAll(text);

        if (tinyldResult.length == 0) return false;

        if (tinyldResult[0].lang !== "fr") return false;

        if (tinyldResult.length == 1) return true;

        if (tinyldResult[0].accuracy > tinyldResult[1].accuracy * 2) return true;
    }
    catch (e) { }

    return false;
}