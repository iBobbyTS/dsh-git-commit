import type { HostContext } from './host-contract.js';
export type * from './protocol.js';
/**
 * DSH Host plugin. Register a feature endpoint on Connection's already-authenticated
 * /api transport, NOT a new webServer route. Connection's own host context does
 * not inject webServer and ctx.connection.rpc.handle() can trigger Cordis's
 * "cannot get property webServer without inject" on that shadow context.
 *
 * Browser/desktop clients use the public connection.rpc.call('/api', 'git-commit', ...)
 * protocol. Other host plugins use the in-process ctx.gitCommit service.
 */
import { GitCommitService } from './core/service.js';
export declare const name = "dsh-git-commit";
export declare const inject: string[];
export declare const ROUTE = "/api/git-commit";
/**
 * The DSH Connection bridge has already authenticated the caller and enforces
 * an owner principal for exact Fetch routes. We only validate application input
 * and return the standard Connection RPC response envelope here.
 */
export declare function createHandler(service: GitCommitService): (request: Request) => Promise<Response>;
export declare function apply(ctx: HostContext, config?: {
    notifyModel?: boolean;
}): void;
//# sourceMappingURL=index.d.ts.map