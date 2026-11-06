import { CommitNotifier } from "./notice.js";
import { commitPrepared, git, plannedMode, preparedSnapshot, repoRoot, repoRootOrNull, visibleStatus } from "./git.js";
import { InstructionStore } from "./store.js";
import { RepoWatcher } from "./watcher.js";
import { cleanMessage, generateMessage, reasoningSelection } from "./message.js";
import { summarizeLlmCalls } from "./metrics.js";
import { mergeAndDeleteBranch, pushBranch } from "./actions.js";
// src/core/service.ts
/** Shared, in-process Git commit service for browser actions and other DSH plugins. */
const failure = (error, scope = null) => ({
	success: false,
	status: "failure",
	scope,
	additions: 0,
	deletions: 0,
	message: "",
	hash: null,
	error: error instanceof Error ? error.message : String(error)
});
/** Requesting Session id for Session-keyed routes; absent when no Session asked for the commit. */
function sessionRoutingId(sessionId) {
	if (typeof sessionId !== "string") return void 0;
	const trimmed = sessionId.trim();
	return trimmed.length ? trimmed : void 0;
}
var GitCommitService = class {
	constructor(ctx, options = {}) {
		this.ctx = ctx;
		this.store = options.store ?? new InstructionStore();
		this.watcher = options.watcher ?? new RepoWatcher();
		this.callModel = options.callModel;
		this.generator = options.generator ?? generateMessage;
		this.notifier = options.notifier === void 0 ? new CommitNotifier(ctx) : options.notifier;
		this.inflight = /* @__PURE__ */ new Map();
		this.operationKinds = /* @__PURE__ */ new Map();
		this.commitStates = /* @__PURE__ */ new Map();
		this.commitSequence = 0;
	}
	resolveCwd(request) {
		const cwd = request?.cwd ?? request?.repositoryPath ?? (typeof request?.sessionId === "string" ? this.ctx.get("sessions")?.get(request.sessionId)?.header?.cwd : void 0);
		if (typeof cwd !== "string" || !cwd.trim()) throw new Error("Missing cwd, repositoryPath, or a session with a working directory");
		return cwd;
	}
	async settingsRoot(request) {
		const cwd = request?.cwd ?? request?.repositoryPath ?? (typeof request?.sessionId === "string" ? this.ctx.get("sessions")?.get(request.sessionId)?.header?.cwd : void 0);
		return repoRootOrNull(cwd);
	}
	async status(request) {
		const root = await repoRootOrNull(this.resolveCwd(request));
		if (root === null) return {
			isRepository: false,
			root: null
		};
		return {
			isRepository: true,
			...await visibleStatus(root)
		};
	}
	async changeToken(request) {
		const root = await repoRootOrNull(this.resolveCwd(request));
		return {
			token: root === null ? null : await this.watcher.token(root),
			commitState: root === null ? null : this.commitStates.get(root) ?? null
		};
	}
	async settings(request) {
		const root = await this.settingsRoot(request);
		return {
			...await this.store.get(root),
			isRepository: root !== null,
			root
		};
	}
	async saveSettings(request) {
		const root = await this.settingsRoot(request);
		for (const key of ["model", "repositoryModel"]) if (request?.patch?.[key]) await this.ctx.llm.resolveModelInfo(request.patch[key].provider, request.patch[key].model);
		return {
			...await this.store.save(root, request?.patch),
			isRepository: root !== null,
			root
		};
	}
	async models() {
		const providers = this.ctx.llm.listProviders();
		const models = [];
		for (const provider of providers) try {
			for (const model of await this.ctx.llm.listModels(provider.id)) models.push({
				provider: provider.id,
				providerName: provider.name,
				model: model.id,
				name: model.name
			});
		} catch {}
		let defaultModel = null;
		try {
			const selection = this.ctx.get("agentDefaultModel")?.currentSelection();
			if (selection?.provider && selection?.model) defaultModel = {
				provider: selection.provider,
				model: selection.model
			};
		} catch {}
		return {
			models,
			defaultModel
		};
	}
	async chosenModel(settings) {
		const selected = settings.repositoryModel ?? settings.model ?? (await this.models()).defaultModel ?? (await this.models()).models[0];
		if (!selected) throw new Error("No configured DSH model is available");
		const provider = selected.provider, model = selected.model;
		const info = await this.ctx.llm.resolveModelInfo(provider, model);
		return {
			provider,
			model,
			reasoningEffort: reasoningSelection(info, "generate"),
			decisionReasoningEffort: reasoningSelection(info, "decide"),
			contextWindow: info?.context?.contextWindow
		};
	}
	async ask({ system, prompt, maxTokens, reasoningEffort, purpose, sessionId }, selection, signal, callRecords) {
		const effectiveSelection = {
			...selection,
			reasoningEffort: reasoningEffort ?? selection.reasoningEffort
		};
		if (this.callModel) {
			const startedAt = performance.now();
			const response = await this.callModel({
				system,
				prompt,
				maxTokens,
				selection: effectiveSelection,
				signal,
				purpose,
				sessionId
			});
			const endedAt = performance.now();
			const annotation = response !== null && typeof response === "object" ? response : null;
			callRecords?.push({
				startedAt,
				endedAt,
				firstTokenAt: Number.isFinite(annotation?.firstTokenMs) ? startedAt + annotation.firstTokenMs : null,
				usage: annotation?.usage ?? null
			});
			return annotation?.text ?? response;
		}
		const { createUserMessage, BlockAssembler } = await import("@deepseek-ai/dsh-llm");
		const messages = [createUserMessage({
			content: [{
				type: "text",
				text: prompt
			}],
			source: {
				kind: "plugin",
				plugin: "dsh-git-commit"
			}
		})];
		const assembler = new BlockAssembler();
		const startedAt = performance.now();
		let firstTokenAt = null;
		try {
			for await (const chunk of this.ctx.llm.stream({
				provider: effectiveSelection.provider,
				model: effectiveSelection.model,
				...effectiveSelection.reasoningEffort === void 0 ? {} : { reasoningEffort: effectiveSelection.reasoningEffort },
				messages,
				system,
				maxTokens,
				...signal ? { signal } : {},
				...purpose ? { purpose: `git-commit.${purpose}` } : {},
				...sessionId ? { sessionId } : {}
			})) {
				if (firstTokenAt === null && (chunk.type === "text-delta" || chunk.type === "reasoning-delta") && chunk.text.length > 0) firstTokenAt = performance.now();
				assembler.push(chunk);
			}
		} finally {
			callRecords?.push({
				startedAt,
				endedAt: performance.now(),
				firstTokenAt,
				usage: assembler.usage ?? null
			});
		}
		if (assembler.finish?.kind === "error" || assembler.finish?.kind === "aborted") throw new Error(assembler.finish.failure?.message ?? `LLM ${assembler.finish.kind}`);
		return assembler.blocks().filter((block) => block.type === "text").map((block) => block.text).join("");
	}
	async commit(request = {}) {
		let root;
		try {
			root = await repoRoot(this.resolveCwd(request));
		} catch (error) {
			return failure(error);
		}
		const current = this.inflight.get(root);
		if (current) return this.operationKinds.get(root) === "commit" ? current : failure("Another Git operation is in progress");
		this.operationKinds.set(root, "commit");
		const id = ++this.commitSequence;
		this.commitStates.set(root, {
			id,
			working: true,
			result: null
		});
		const execute = Promise.resolve().then(() => this.commitOnce(root, request)).catch((error) => failure(error)).then((result) => {
			this.commitStates.set(root, {
				id,
				working: false,
				result
			});
			return result;
		}).finally(() => {
			if (this.inflight.get(root) === execute) {
				this.inflight.delete(root);
				this.operationKinds.delete(root);
			}
		});
		this.inflight.set(root, execute);
		return execute;
	}
	async followUp(kind, request, operation) {
		let root;
		try {
			root = await repoRoot(this.resolveCwd(request));
		} catch (error) {
			return failure(error);
		}
		const current = this.inflight.get(root);
		if (current) return this.operationKinds.get(root) === kind ? current : failure("Another Git operation is in progress");
		this.operationKinds.set(root, kind);
		const execute = Promise.resolve().then(() => operation(root)).catch((error) => failure(error)).finally(() => {
			if (this.inflight.get(root) === execute) {
				this.inflight.delete(root);
				this.operationKinds.delete(root);
			}
		});
		this.inflight.set(root, execute);
		return execute;
	}
	push(request = {}) {
		return this.followUp("push", request, pushBranch);
	}
	mergeAndDelete(request = {}) {
		return this.followUp("mergeAndDelete", request, mergeAndDeleteBranch);
	}
	async commitOnce(root, request) {
		const operationStartedAt = performance.now();
		const llmCalls = [];
		const sessionId = sessionRoutingId(request?.sessionId);
		let scope = null;
		try {
			scope = await plannedMode(root);
			if (scope === "all") await git(root, [
				"add",
				"-A",
				"--",
				"."
			], { timeout: 18e4 });
			const snapshot = await preparedSnapshot(root, "staged");
			if (!snapshot.paths.length) return failure("Nothing to commit", scope);
			let message;
			if (request.message !== void 0) message = cleanMessage(request.message);
			else {
				const settings = await this.store.get(root);
				const selection = await this.chosenModel(settings);
				const recent = await git(root, [
					"log",
					"-5",
					"--pretty=format:%s"
				]).catch(() => "");
				message = await this.generator(snapshot, settings, (values) => this.ask({
					...values,
					sessionId
				}, selection, request.signal, llmCalls), {
					history: recent.split("\n").filter(Boolean),
					decisionReasoningEffort: selection.decisionReasoningEffort,
					generationReasoningEffort: selection.reasoningEffort,
					contextWindow: selection.contextWindow
				});
			}
			const result = await commitPrepared(snapshot, message);
			if (this.notifier) await this.notifier.announce(request.sessionId, {
				hash: result.hash,
				message: result.message,
				cwd: root
			}).catch(() => {});
			return {
				...result,
				scope,
				...llmCalls.length ? { llm: summarizeLlmCalls(llmCalls) } : {},
				totalDurationMs: Math.max(0, performance.now() - operationStartedAt)
			};
		} catch (error) {
			return failure(error, scope);
		}
	}
	close() {
		this.watcher.close();
	}
};
export { GitCommitService };

//# sourceMappingURL=service.js.map