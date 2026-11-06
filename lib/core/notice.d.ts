import type { HostContext } from '../host-contract.js';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { UserMessage } from '@deepseek-ai/dsh-llm';
interface NoticeEntry {
    messageId: string;
    hash: string;
    text: string;
    summary: string;
    cwd: string | null;
    at: number;
}
export interface NoticeOptions {
    store?: PendingNoticeStore;
    headMatches?: typeof headMatches;
    createMessage?: typeof createNoticeMessage;
    now?: () => number;
}
/** Source kind of the injected context; also the Chat row's producer label. */
export declare const NOTICE_KIND = "git-commit";
/** A pending notice older than this is dropped rather than replayed. */
export declare const NOTICE_MAX_AGE_MS: number;
/** Upper bound on remembered Sessions so an abandoned replay cannot grow the file. */
export declare const NOTICE_LIMIT = 100;
/** Pending commit notices keyed by Session, kept beside the settings file. */
export declare const noticePath: () => string;
/**
 * Build the model-facing text and the collapsed Chat summary for one commit.
 * @param {{hash: string, message: string}} commit - The resulting commit.
 * @returns {{text: string, summary: string}} Model content plus its one-line account.
 */
export declare function noticeContent({ hash, message, }: {
    hash: string;
    message: string;
}): {
    text: string;
    summary: string;
};
/**
 * Atomic JSON store of undelivered commit notices.
 *
 * Mutations are serialized through one promise chain so a delivery that lands
 * between a record and its disk write cannot resurrect a cleared entry. Reads
 * through {@link PendingNoticeStore.peek} are synchronous because the delivery
 * feed is a fire-and-forget emit.
 */
export declare class PendingNoticeStore {
    path: string;
    now: () => number;
    entries: Map<string, NoticeEntry>;
    loading: Promise<void> | null;
    writes: Promise<void>;
    constructor(path?: string, { now }?: {
        now?: (() => number) | undefined;
    });
    /** Load once; a missing or unreadable file is treated as empty. */
    ready(): Promise<void>;
    load(): Promise<void>;
    /** Synchronous lookup used by the delivery feed, which cannot await. */
    peek(sessionId: string): NoticeEntry | undefined;
    /** Record (or replace) the Session's pending notice, then persist it. */
    put(sessionId: string, entry: NoticeEntry): Promise<Promise<void>>;
    /** Forget the Session's pending notice. */
    clear(sessionId: string): Promise<false | Promise<void>>;
    /** Forget the notice only while it still refers to `messageId`. */
    clearIf(sessionId: string, messageId: string): Promise<false | Promise<boolean>>;
    /** Drop expired entries and cap the file at {@link NOTICE_LIMIT} Sessions. */
    prune(): void;
    enqueue<T>(task: () => T): Promise<T>;
    flush(): Promise<void>;
}
/** Whether the repository still points at the notice's commit. */
declare function headMatches(cwd: string | null, hash: string): Promise<boolean>;
declare function createNoticeMessage({ text, summary, }: {
    text: string;
    summary: string;
}): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    source: {
        kind: "git-commit";
        form: "notice";
        summary: string;
    };
} & Pick<UserMessage, "id" | "role">>;
/**
 * Delivers commit notices into Agent inboxes and keeps them recoverable.
 *
 * Never throws into the commit path or the Agent-creation path: a notice is
 * advisory, so every failure degrades to "no notice" instead of a failed commit.
 */
export declare class CommitNotifier {
    ctx: HostContext;
    store: PendingNoticeStore;
    headMatches: typeof headMatches;
    createMessage: typeof createNoticeMessage;
    now: () => number;
    constructor(ctx: HostContext, options?: NoticeOptions);
    /** The live Agent for a Session, or undefined when nothing is attached. */
    agentFor(sessionId: string): Agent | undefined;
    warn(action: string, error: unknown): void;
    /**
     * Announce a successful commit to the Session that requested it.
     * @param {string | undefined} sessionId - Requesting Session; no Session means no inbox.
     * @param {{hash: string, message: string, cwd?: string}} commit - The resulting commit.
     */
    announce(sessionId: string | undefined, { hash, message, cwd }: {
        hash: string;
        message: string;
        cwd?: string;
    }): Promise<void>;
    /**
     * Re-deliver a notice that was still pending when its Agent was disposed.
     * @param {{session: {id: string}}} agent - The freshly created Agent.
     */
    replay(agent: Agent): Promise<void>;
    /**
     * Retire the notice once the model has actually been given it.
     *
     * The `user/message` append — not the inbox claim — is the delivery proof: a
     * claimed batch can still be rejected or cancelled before it enters a request.
     * @param {{id: string}} session - Session that committed the event.
     * @param {{type: string, data?: {id?: string}}} event - One appended Session event.
     * @returns {Promise<boolean>} Whether a pending record was cleared.
     */
    delivered(session: {
        id: string;
    } | undefined, event: {
        type: string;
        data?: unknown;
    } | undefined): Promise<boolean> | Promise<false | Promise<boolean>>;
    /**
     * Retire the notice when the harness discards the queued message, so a
     * cancelled input is never resurrected by a later replay.
     * @param {{session: {id: string}}} agent - Agent that discarded the message.
     * @param {{id: string}} message - The discarded message.
     * @returns {Promise<boolean>} Whether a pending record was cleared.
     */
    discarded(agent: Agent | undefined, message: {
        id: string;
    } | undefined): Promise<boolean> | Promise<false | Promise<boolean>>;
    /** Forget the record only while it still refers to `messageId`. */
    retire(sessionId: unknown, messageId: unknown): Promise<boolean> | Promise<false | Promise<boolean>>;
}
export {};
//# sourceMappingURL=notice.d.ts.map