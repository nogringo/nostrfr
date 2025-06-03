export function isFrench(text) {
    text = text
        .split(' ')
        .filter(word => word.length <= 20 && !word.startsWith('#'))
        .join(' ');

    const francResult = franc(text);

    try {
        const tinyldResult = detectAll(text)[0];

        if (tinyldResult.lang === "fr" && tinyldResult.accuracy != 0.25 && tinyldResult.accuracy > 0.15 && francResult === "fra") {
            return true;
        }
    }
    catch (e) { }

    return false;
}