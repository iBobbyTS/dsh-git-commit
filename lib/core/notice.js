import { dirname, join } from "node:path";
import { git } from "./git.js";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
// src/core/notice.ts
/**
* Model-visible "already committed" notice.
*
* The notice is delivered through the owning Agent's inbox (`agent.inject`), not
* appended to the Session directly: a running Agent claims it at its next step
* boundary, an idle one keeps it pending until the user's next message, and the
* inbox claim order puts it before that message. Injection never wakes the Agent.
*
* Pending notices are recorded outside the Session because a graceful Agent
* dispose durably clears its inbox. `agent/created` replays an undelivered
* notice after a restart, re-validating it against Git first so a stale notice
* cannot be re-injected once HEAD moved on.
*/
/** Source kind of the injected context; also the Chat row's producer label. */
const NOTICE_KIND = "git-commit";
/** A pending notice older than this is dropped rather than replayed. */
const NOTICE_MAX_AGE_MS = 6048e5;
/** Upper bound on remembered Sessions so an abandoned replay cannot grow the file. */
const NOTICE_LIMIT = 100;
/** Bound on the collapsed Chat row's one-line account. */
const SUMMARY_MAX_CHARS = 120;
const SUBJECT_MAX_CHARS = 200;
const HOME = () => process.env.DSH_HOME || join(homedir(), ".dsh");
/** Pending commit notices keyed by Session, kept beside the settings file. */
const noticePath = () => join(HOME(), "dsh-git-commit-notices.json");
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const bound = (value, limit) => value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
/** First line of the commit message, which is what a notice can afford to show. */
function subjectOf(message) {
	const [first = ""] = String(message ?? "").split("\n");
	return bound(first.trim(), SUBJECT_MAX_CHARS);
}
/**
* Build the model-facing text and the collapsed Chat summary for one commit.
* @param {{hash: string, message: string}} commit - The resulting commit.
* @returns {{text: string, summary: string}} Model content plus its one-line account.
*/
function noticeContent({ hash, message }) {
	const subject = subjectOf(message) || "(no subject)";
	return {
		text: `Git commit ${hash} was created in this repository: "${subject}"\nThose working-tree changes are now committed. Do not commit the same changes again, and do not amend or reset this commit unless the user asks.`,
		summary: bound(`Committed ${hash} · ${subject}`, SUMMARY_MAX_CHARS)
	};
}
/** One durable pending notice; `messageId` identifies the message currently in the inbox. */
const readEntry = (value) => {
	if (!plain(value)) return null;
	const { messageId, hash, text, summary, cwd, at } = value;
	if (typeof messageId !== "string" || !messageId) return null;
	if (typeof hash !== "string" || !hash) return null;
	if (typeof text !== "string" || !text) return null;
	if (typeof summary !== "string" || !summary) return null;
	if (typeof at !== "number" || !Number.isFinite(at)) return null;
	return {
		messageId,
		hash,
		text,
		summary,
		cwd: typeof cwd === "string" && cwd ? cwd : null,
		at
	};
};
/**
* Atomic JSON store of undelivered commit notices.
*
* Mutations are serialized through one promise chain so a delivery that lands
* between a record and its disk write cannot resurrect a cleared entry. Reads
* through {@link PendingNoticeStore.peek} are synchronous because the delivery
* feed is a fire-and-forget emit.
*/
var PendingNoticeStore = class {
	constructor(path = noticePath(), { now = () => Date.now() } = {}) {
		this.path = path;
		this.now = now;
		this.entries = /* @__PURE__ */ new Map();
		this.loading = null;
		this.writes = Promise.resolve();
	}
	/** Load once; a missing or unreadable file is treated as empty. */
	ready() {
		this.loading ??= this.load();
		return this.loading;
	}
	async load() {
		let data;
		try {
			data = JSON.parse(await readFile(this.path, "utf8"));
		} catch {
			return;
		}
		const sessions = plain(data) && data.version === 1 && plain(data.sessions) ? data.sessions : {};
		for (const [sessionId, raw] of Object.entries(sessions)) {
			const entry = readEntry(raw);
			if (entry !== null && this.now() - entry.at < 6048e5) this.entries.set(sessionId, entry);
		}
		this.prune();
	}
	/** Synchronous lookup used by the delivery feed, which cannot await. */
	peek(sessionId) {
		return this.entries.get(sessionId);
	}
	/** Record (or replace) the Session's pending notice, then persist it. */
	put(sessionId, entry) {
		return this.enqueue(() => {
			this.entries.set(sessionId, entry);
			this.prune();
			return this.flush();
		});
	}
	/** Forget the Session's pending notice. */
	clear(sessionId) {
		return this.enqueue(() => this.entries.delete(sessionId) ? this.flush() : false);
	}
	/** Forget the notice only while it still refers to `messageId`. */
	clearIf(sessionId, messageId) {
		return this.enqueue(() => {
			const entry = this.entries.get(sessionId);
			if (entry === void 0 || entry.messageId !== messageId) return false;
			this.entries.delete(sessionId);
			return this.flush().then(() => true);
		});
	}
	/** Drop expired entries and cap the file at {@link NOTICE_LIMIT} Sessions. */
	prune() {
		const now = this.now();
		for (const [sessionId, entry] of this.entries) if (now - entry.at >= 6048e5) this.entries.delete(sessionId);
		if (this.entries.size <= 100) return;
		const oldestFirst = [...this.entries].sort((left, right) => left[1].at - right[1].at);
		for (const [sessionId] of oldestFirst.slice(0, this.entries.size - 100)) this.entries.delete(sessionId);
	}
	enqueue(task) {
		const run = this.writes.then(async () => {
			await this.ready();
			return task();
		});
		this.writes = run.then(() => void 0, () => void 0);
		return run;
	}
	async flush() {
		const sessions = Object.fromEntries(this.entries);
		await mkdir(dirname(this.path), { recursive: true });
		const tmp = `${this.path}.${randomUUID()}.tmp`;
		try {
			await writeFile(tmp, `${JSON.stringify({
				version: 1,
				sessions
			}, null, 2)}\n`, {
				mode: 384,
				flag: "wx"
			});
			await rename(tmp, this.path);
		} finally {
			await rm(tmp, { force: true });
		}
	}
};
/** Whether the repository still points at the notice's commit. */
async function headMatches(cwd, hash) {
	if (typeof cwd !== "string" || !cwd) return false;
	try {
		return (await git(cwd, [
			"rev-parse",
			"--verify",
			"HEAD"
		], { timeout: 5e3 })).trim().startsWith(hash);
	} catch {
		return false;
	}
}
async function createNoticeMessage({ text, summary }) {
	const { createUserMessage } = await import("@deepseek-ai/dsh-llm");
	return createUserMessage({
		content: [{
			type: "text",
			text
		}],
		source: {
			kind: NOTICE_KIND,
			form: "notice",
			summary
		}
	});
}
const injectQuietly = (agent, message) => {
	try {
		agent.inject(message);
	} catch {}
};
const removeQuietly = (agent, messageId) => {
	try {
		agent?.inbox?.remove(messageId);
	} catch {}
};
const queued = (agent, messageId) => {
	try {
		return agent?.inbox?.nextStep?.some((message) => message.id === messageId) === true;
	} catch {
		return false;
	}
};
/**
* Delivers commit notices into Agent inboxes and keeps them recoverable.
*
* Never throws into the commit path or the Agent-creation path: a notice is
* advisory, so every failure degrades to "no notice" instead of a failed commit.
*/
var CommitNotifier = class {
	constructor(ctx, options = {}) {
		this.ctx = ctx;
		this.store = options.store ?? new PendingNoticeStore();
		this.headMatches = options.headMatches ?? headMatches;
		this.createMessage = options.createMessage ?? createNoticeMessage;
		this.now = options.now ?? (() => Date.now());
	}
	/** The live Agent for a Session, or undefined when nothing is attached. */
	agentFor(sessionId) {
		try {
			return this.ctx.get("agents")?.get(sessionId);
		} catch {
			return;
		}
	}
	warn(action, error) {
		try {
			this.ctx.logger?.warn?.(`dsh-git-commit: could not ${action} the commit notice: ${error instanceof Error ? error.message : String(error)}`);
		} catch {}
	}
	/**
	* Announce a successful commit to the Session that requested it.
	* @param {string | undefined} sessionId - Requesting Session; no Session means no inbox.
	* @param {{hash: string, message: string, cwd?: string}} commit - The resulting commit.
	*/
	async announce(sessionId, { hash, message, cwd }) {
		if (typeof sessionId !== "string" || !sessionId) return;
		if (typeof hash !== "string" || !hash) return;
		try {
			await this.store.ready();
			const agent = this.agentFor(sessionId);
			const previous = this.store.peek(sessionId);
			if (previous !== void 0) removeQuietly(agent, previous.messageId);
			const content = noticeContent({
				hash,
				message
			});
			const userMessage = await this.createMessage(content);
			await this.store.put(sessionId, {
				messageId: userMessage.id,
				hash,
				text: content.text,
				summary: content.summary,
				cwd: typeof cwd === "string" && cwd ? cwd : null,
				at: this.now()
			}).catch((error) => this.warn("record", error));
			if (agent !== void 0) injectQuietly(agent, userMessage);
		} catch (error) {
			this.warn("deliver", error);
		}
	}
	/**
	* Re-deliver a notice that was still pending when its Agent was disposed.
	* @param {{session: {id: string}}} agent - The freshly created Agent.
	*/
	async replay(agent) {
		const sessionId = agent?.session?.id;
		if (typeof sessionId !== "string" || !sessionId) return;
		try {
			await this.store.ready();
			const entry = this.store.peek(sessionId);
			if (entry === void 0) return;
			if (queued(agent, entry.messageId)) return;
			if (!await this.headMatches(entry.cwd, entry.hash)) {
				await this.store.clear(sessionId).catch((error) => this.warn("drop", error));
				return;
			}
			const userMessage = await this.createMessage({
				text: entry.text,
				summary: entry.summary
			});
			await this.store.put(sessionId, {
				...entry,
				messageId: userMessage.id,
				at: this.now()
			}).catch((error) => this.warn("record", error));
			injectQuietly(agent, userMessage);
		} catch (error) {
			this.warn("replay", error);
		}
	}
	/**
	* Retire the notice once the model has actually been given it.
	*
	* The `user/message` append — not the inbox claim — is the delivery proof: a
	* claimed batch can still be rejected or cancelled before it enters a request.
	* @param {{id: string}} session - Session that committed the event.
	* @param {{type: string, data?: {id?: string}}} event - One appended Session event.
	* @returns {Promise<boolean>} Whether a pending record was cleared.
	*/
	delivered(session, event) {
		if (event?.type !== "user/message") return Promise.resolve(false);
		return this.retire(session?.id, event.data?.id);
	}
	/**
	* Retire the notice when the harness discards the queued message, so a
	* cancelled input is never resurrected by a later replay.
	* @param {{session: {id: string}}} agent - Agent that discarded the message.
	* @param {{id: string}} message - The discarded message.
	* @returns {Promise<boolean>} Whether a pending record was cleared.
	*/
	discarded(agent, message) {
		return this.retire(agent?.session?.id, message?.id);
	}
	/** Forget the record only while it still refers to `messageId`. */
	retire(sessionId, messageId) {
		if (typeof sessionId !== "string" || !sessionId) return Promise.resolve(false);
		if (typeof messageId !== "string" || !messageId) return Promise.resolve(false);
		const entry = this.store.peek(sessionId);
		if (entry === void 0 || entry.messageId !== messageId) return Promise.resolve(false);
		const clearing = this.store.clearIf(sessionId, messageId);
		clearing.catch((error) => this.warn("clear", error));
		return clearing;
	}
};
export { CommitNotifier, NOTICE_KIND, NOTICE_LIMIT, NOTICE_MAX_AGE_MS, PendingNoticeStore, noticeContent, noticePath };

//# sourceMappingURL=notice.js.map