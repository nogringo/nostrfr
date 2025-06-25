import { detect } from 'tinyld';

export function isFrench(text) {
    text = text
        .split(' ')
        .filter(word => word.length <= 20 && !word.startsWith('#') && !word.startsWith('http'))
        .join(' ');

    try {
        const tinyldResult = detect(text);

        if (tinyldResult === "fr") return true;
    }
    catch (e) { }

    return false;
}