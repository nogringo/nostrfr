import { detectAll } from 'tinyld';
import { bannedWords } from '../config.js';

export function isFrench(text, minAccuracy) {
    if (bannedWords.some(word => text.includes(word))) return false;

    text = text
        .split(' ')
        .filter((word) => !word.startsWith('#') && !word.startsWith('http') && !word.startsWith('nostr:npub') && !word.startsWith('nostr:note'))
        .join(' ');

    try {
        const tinyldResult = detectAll(text);

        if (tinyldResult.length == 0) return false;

        if (tinyldResult[0].lang !== "fr") return false;

        if (tinyldResult[0].accuracy < (minAccuracy || 0)) return false;

        if (tinyldResult.length == 1) return true;

        if (tinyldResult[0].accuracy > tinyldResult[1].accuracy * 2) return true;
    }
    catch (e) { }

    return false;
}