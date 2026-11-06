import { resolve } from "node:path";
import { defaultBranch, git } from "./git.js";
import { details } from "./errors.js";
import { access } from "node:fs/promises";
// src/core/actions.ts
/** Explicit user-requested follow-up operations. Never force push or force delete. */
const detail = (error) => String(details(error).stderr?.trim() || details(error).message || error);
async function attachedBranch(root) {
	try {
		return (await git(root, [
			"symbolic-ref",
			"--quiet",
			"--short",
			"HEAD"
		])).trim();
	} catch {
		throw new Error("A checked-out local branch is required (detached HEAD is not supported)");
	}
}
async function requireIdle(root) {
	for (const marker of [
		"MERGE_HEAD",
		"CHERRY_PICK_HEAD",
		"REVERT_HEAD",
		"rebase-merge",
		"rebase-apply",
		"sequencer"
	]) {
		const path = (await git(root, [
			"rev-parse",
			"--git-path",
			marker
		])).trim();
		if (await access(resolve(root, path)).then(() => true, (error) => {
			if (details(error).code === "ENOENT") return false;
			throw error;
		})) throw new Error(`Finish the ongoing Git operation first (${marker})`);
	}
}
async function pushBranch(root) {
	let branch;
	try {
		branch = await attachedBranch(root);
		await requireIdle(root);
		await git(root, [
			"rev-parse",
			"--verify",
			"HEAD"
		]);
		const upstream = await git(root, [
			"rev-parse",
			"--abbrev-ref",
			"--symbolic-full-name",
			"@{upstream}"
		]).then((value) => value.trim(), () => null);
		const output = await git(root, upstream ? ["push", "--porcelain"] : [
			"push",
			"--porcelain",
			"--set-upstream",
			"origin",
			`HEAD:refs/heads/${branch}`
		], {
			timeout: 18e4,
			env: { GIT_TERMINAL_PROMPT: "0" }
		});
		const refs = output.split(/\r?\n/).filter((line) => /^[ =*+!\-]\t/.test(line));
		const upToDate = refs.length > 0 && refs.every((line) => line.startsWith("=	"));
		return {
			success: true,
			status: "success",
			branch,
			upToDate,
			message: output.trim()
		};
	} catch (error) {
		return {
			success: false,
			status: "failure",
			branch,
			error: detail(error)
		};
	}
}
async function mergeAndDeleteBranch(root) {
	let source = null, target = null, stage = "preflight", merged = false, deleted = false;
	try {
		source = await attachedBranch(root);
		target = await defaultBranch(root);
		if (!target) throw new Error("origin/HEAD is unavailable; set the remote default branch before merging");
		if (source === target || source === "main") throw new Error("The default branch and main cannot be merged and deleted");
		await git(root, [
			"show-ref",
			"--verify",
			`refs/heads/${target}`
		]);
		await requireIdle(root);
		if ((await git(root, [
			"status",
			"--porcelain",
			"--untracked-files=all"
		])).length) throw new Error("Commit or stash all staged, unstaged and untracked changes before merging");
		const sourceHash = (await git(root, ["rev-parse", `refs/heads/${source}`])).trim();
		stage = "switch";
		await git(root, [
			"switch",
			"--no-guess",
			"--",
			target
		]);
		stage = "merge";
		await git(root, [
			"merge",
			"--no-edit",
			"--",
			sourceHash
		], { timeout: 18e4 });
		merged = true;
		stage = "delete";
		if ((await git(root, ["rev-parse", `refs/heads/${source}`])).trim() !== sourceHash) throw new Error("Source branch moved during merge; it has been retained");
		await git(root, [
			"branch",
			"-d",
			"--",
			source
		]);
		deleted = true;
		return {
			success: true,
			status: "success",
			source,
			target,
			stage: "done",
			merged,
			deleted
		};
	} catch (error) {
		return {
			success: false,
			status: "failure",
			source,
			target,
			stage,
			merged,
			deleted,
			error: `${stage}: ${merged ? `Merged ${source} into ${target}, but local source branch was retained. ` : ""}${detail(error)}${stage === "merge" ? "\nSource branch retained; inspect the target branch for merge conflicts." : ""}`
		};
	}
}
export { mergeAndDeleteBranch, pushBranch };

//# sourceMappingURL=actions.js.map