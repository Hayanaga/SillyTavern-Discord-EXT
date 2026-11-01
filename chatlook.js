// What a person looks like in one chat: a background for their profile banner and a picture of
// their own, kept in the chat's metadata so another chat with them is untouched.

const META_KEY = 'dsc_look';

/** Whether a chat is open to keep them in. */
export function hasOpenChat() {
    return !!SillyTavern.getContext().getCurrentChatId();
}

/** @returns {{background?: string, picture?: string}} A person's look in the open chat */
export function chatLook(key) {
    return SillyTavern.getContext().chatMetadata?.[META_KEY]?.[key] ?? {};
}

/** Sets or, with an empty value, clears part of a person's look in the open chat. */
export function setChatLook(key, field, value) {
    const context = SillyTavern.getContext();
    const all = context.chatMetadata[META_KEY] ??= {};
    const own = all[key] ??= {};
    if (value) {
        own[field] = value;
    } else {
        delete own[field];
    }
    context.saveMetadata();
}
