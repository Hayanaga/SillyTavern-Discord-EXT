// Splits one chat reply (markdown) into several short messages, the way people text: a new
// message after each sentence or two. Self-contained and dependency-free (no DOM, no
// SillyTavern), so the same file can sit in any theme.
//
//   splitMessage(text, options?) => string[]
//
// Each part is valid markdown on its own: nothing is cut inside *…*, **…**, _…_, `code`,
// code fences, ||spoilers||, quotes ("…", “…”, '…', «…», 「…」), lists, tables, headings or blockquotes.
// Paragraphs (blank lines) always start a new part. Inside a paragraph, a part ends after
// . ! ? … (and runs like ?! !!! ...) or 。！？, never after abbreviations (Mr. e.g. etc.),
// initials (J. R. R.), decimals, URLs or e-mails, nor an ellipsis that runs on in lower case.
// A sentence that ends right before a closing quote or emphasis mark ends after that mark.
// Sentences are then grouped, up to maxSentences per part and maxLength characters.

/**
 * @typedef {object} SplitOptions
 * @property {number} [maxSentences=2] Sentences per part at most
 * @property {number} [maxLength=220] Characters per part before grouping stops (a single longer sentence stays whole)
 * @property {boolean} [paragraphs=true] Start a new part at each blank line
 */

const ABBREVIATIONS = new Set([
    'mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'ave', 'vs', 'etc', 'e.g', 'i.e',
    'eg', 'ie', 'approx', 'no', 'nos', 'fig', 'figs', 'inc', 'ltd', 'co', 'corp', 'dept', 'est',
    'vol', 'ch', 'pp', 'p', 'cf', 'al', 'gen', 'col', 'lt', 'sgt', 'capt', 'rev', 'hon', 'jan',
    'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'a.m', 'p.m',
    'u.s', 'u.k', 'ph.d', 'm.d', 'b.a', 'm.a',
]);

const LATIN_ENDS = new Set(['.', '!', '?', '…']);
const CJK_ENDS = new Set(['。', '！', '？', '｡']);
/** opening quote → closing quote */
const QUOTE_PAIRS = { '"': '"', '“': '”', '«': '»', '「': '」', '『': '』', '‘': '’', '„': '“' };

function isSpace(char) {
    return char === undefined || /\s/.test(char);
}

function isWordChar(char) {
    return !!char && /[\p{L}\p{N}]/u.test(char);
}

/* ---------- blocks ---------- */

const FENCE = /^\s{0,3}(```|~~~)/;
const ATOMIC_LINE = /^\s{0,3}(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>|\|)/;

/** Splits text into paragraphs, keeping fences, lists, tables, headings and quotes whole. */
function toBlocks(text, paragraphs) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    /** @type {{text: string, atomic: boolean}[]} */
    const blocks = [];
    let current = [];
    let currentAtomic = false;
    const flush = () => {
        const body = current.join('\n').trim();
        if (body) {
            blocks.push({ text: body, atomic: currentAtomic });
        }
        current = [];
        currentAtomic = false;
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const fence = line.match(FENCE);
        if (fence) {
            flush();
            const block = [line];
            i++;
            while (i < lines.length && !lines[i].trimStart().startsWith(fence[1])) {
                block.push(lines[i]);
                i++;
            }
            if (i < lines.length) {
                block.push(lines[i]);
            }
            current = block;
            currentAtomic = true;
            flush();
            continue;
        }
        if (!line.trim()) {
            if (paragraphs) {
                flush();
            } else {
                current.push(line);
            }
            continue;
        }
        const atomic = ATOMIC_LINE.test(line);
        if (atomic !== currentAtomic && current.length) {
            flush();
        }
        currentAtomic = atomic;
        current.push(line);
    }
    flush();
    return blocks;
}

/* ---------- sentences ---------- */

/** The word just before position i (letters, digits and inner dots), lower-cased. */
function wordBefore(text, i) {
    let start = i;
    while (start > 0 && /[\p{L}\p{N}.]/u.test(text[start - 1])) {
        start--;
    }
    return text.slice(start, i).toLowerCase();
}

function nextNonSpace(text, i) {
    while (i < text.length && isSpace(text[i])) {
        i++;
    }
    return text[i];
}

/** Whether a sentence may end at a run of end marks that closes at position `end`. */
function canEnd(text, runStart, end) {
    const run = text.slice(runStart, end);
    if (CJK_ENDS.has(run[run.length - 1])) {
        return true;
    }
    if (!isSpace(text[end])) {
        return false;
    }
    const next = nextNonSpace(text, end);
    if (next === undefined) {
        return true;
    }
    // an ellipsis that runs on in lower case continues the sentence
    const lowerNext = /\p{Ll}/u.test(next);
    if (lowerNext) {
        return false;
    }
    if (run === '.') {
        const word = wordBefore(text, runStart);
        if (ABBREVIATIONS.has(word) || ABBREVIATIONS.has(word.replace(/\.$/, ''))) {
            return false;
        }
        // an initial: a single capital letter
        if (/^\p{Lu}$/u.test(text.slice(runStart - 1, runStart)) && !isWordChar(text[runStart - 2])) {
            return false;
        }
    }
    return true;
}

/** Whether a sentence may end just after a closing quote or emphasis mark at position i:
    a space follows, and the next word doesn't carry on in lower case ("…?" she asked). */
function canEndAfterCloser(text, i) {
    if (i >= text.length) {
        return true;
    }
    if (!isSpace(text[i])) {
        return false;
    }
    const next = nextNonSpace(text, i);
    return next === undefined || !/\p{Ll}/u.test(next);
}

/**
 * Splits prose into sentences, never inside quotes, emphasis or code.
 * @param {string} text
 * @returns {string[]}
 */
function toSentences(text) {
    const sentences = [];
    let start = 0;
    /** open spans: quote closers, '*', '**', '_', '`' */
    const stack = [];
    let endedInside = false;

    const cut = (at) => {
        const piece = text.slice(start, at).trim();
        if (piece) {
            sentences.push(piece);
        }
        start = at;
        endedInside = false;
    };

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const top = stack[stack.length - 1];

        // inline code: nothing inside counts
        if (char === '`') {
            if (top === '`') {
                stack.pop();
            } else {
                stack.push('`');
            }
            continue;
        }
        if (top === '`') {
            continue;
        }

        // ||spoilers|| stay whole (an opening || counts only if it's closed later)
        if (char === '|' && text[i + 1] === '|') {
            if (top === '||') {
                stack.pop();
                i++;
                if (!stack.length && endedInside && canEndAfterCloser(text, i + 1)) {
                    cut(i + 1);
                }
            } else if (text.indexOf('||', i + 2) !== -1) {
                stack.push('||');
                i++;
            }
            continue;
        }

        // emphasis: * or ** (and _ at word edges)
        if (char === '*' || (char === '_' && (!isWordChar(text[i - 1]) || !isWordChar(text[i + 1])))) {
            let run = char;
            while (text[i + run.length] === char) {
                run += char;
            }
            const marker = run.length >= 2 ? char + char : char;
            const opening = !isSpace(text[i + run.length]) && (isSpace(text[i - 1]) || !isWordChar(text[i - 1]) || stack.indexOf(marker) === -1);
            if (stack.includes(marker) && !isSpace(text[i - 1])) {
                // close back to this marker
                while (stack.length && stack[stack.length - 1] !== marker) {
                    stack.pop();
                }
                stack.pop();
            } else if (opening) {
                stack.push(marker);
            }
            i += run.length - 1;
            if (!stack.length && endedInside && canEndAfterCloser(text, i + 1)) {
                cut(i + 1);
            }
            continue;
        }

        // quotes
        if (top !== undefined && top === char && !['*', '**', '_', '_'].includes(top)) {
            stack.pop();
            if (!stack.length && endedInside && (canEndAfterCloser(text, i + 1) || CJK_ENDS.has(text[i - 1]))) {
                cut(i + 1);
            }
            continue;
        }
        if (char === '\'') {
            // a single quote opens at a word start and closes at a word end; apostrophes inside words don't count
            if (top === '\'' && !isSpace(text[i - 1]) && !isWordChar(text[i + 1])) {
                stack.pop();
                if (!stack.length && endedInside && canEndAfterCloser(text, i + 1)) {
                    cut(i + 1);
                }
            } else if ((isSpace(text[i - 1]) || /[([{]/.test(text[i - 1] ?? '')) && isWordChar(text[i + 1])) {
                stack.push('\'');
            }
            continue;
        }
        if (Object.hasOwn(QUOTE_PAIRS, char)) {
            // " opens or closes; the others always open
            stack.push(QUOTE_PAIRS[char]);
            continue;
        }

        // end marks
        if (LATIN_ENDS.has(char) || CJK_ENDS.has(char)) {
            let end = i + 1;
            while (end < text.length && (LATIN_ENDS.has(text[end]) || CJK_ENDS.has(text[end]))) {
                end++;
            }
            const runStart = i;
            i = end - 1;
            // a dot between digits or inside a word (3.14, example.com) is not an end
            if (char === '.' && end - runStart === 1 && isWordChar(text[end])) {
                continue;
            }
            if (stack.length) {
                endedInside = canEnd(text, runStart, end) || isClosingNext(text, end, stack);
                continue;
            }
            if (canEnd(text, runStart, end)) {
                cut(end);
            }
        }
    }
    cut(text.length);
    return sentences;
}

/** Whether the marks right after an end are the closers of every open span. */
function isClosingNext(text, end, stack) {
    let i = end;
    const closers = [...stack].reverse();
    for (const closer of closers) {
        if (text.startsWith(closer, i)) {
            i += closer.length;
        } else {
            return false;
        }
    }
    return isSpace(text[i]) || i >= text.length;
}

/* ---------- grouping ---------- */

function hasContent(piece) {
    return /[\p{L}\p{N}]/u.test(piece);
}

/** Joins pieces without letters or digits (a lone "…" or "!!") onto the one before. */
function absorbEmpty(pieces) {
    const out = [];
    for (const piece of pieces) {
        if (!hasContent(piece) && out.length) {
            out[out.length - 1] += ` ${piece}`;
        } else {
            out.push(piece);
        }
    }
    return out;
}

function group(sentences, maxSentences, maxLength) {
    const parts = [];
    let current = [];
    let length = 0;
    for (const sentence of sentences) {
        if (current.length && (current.length >= maxSentences || length + 1 + sentence.length > maxLength)) {
            parts.push(current.join(' '));
            current = [];
            length = 0;
        }
        current.push(sentence);
        length += (length ? 1 : 0) + sentence.length;
    }
    if (current.length) {
        parts.push(current.join(' '));
    }
    return parts;
}

/**
 * Splits a message into short parts.
 * @param {string} text Raw message markdown
 * @param {SplitOptions} [options]
 * @returns {string[]} The parts; [text] (trimmed) when there is nothing to split, [] for empty text
 */
export function splitMessage(text, options = {}) {
    const { maxSentences = 2, maxLength = 220, paragraphs = true } = options;
    const source = String(text ?? '');
    if (!source.trim()) {
        return [];
    }
    const parts = [];
    for (const block of toBlocks(source, paragraphs)) {
        if (block.atomic) {
            parts.push(block.text);
            continue;
        }
        parts.push(...group(absorbEmpty(toSentences(block.text)), Math.max(1, maxSentences), Math.max(1, maxLength)));
    }
    return absorbEmpty(parts.filter(Boolean));
}

export default splitMessage;
