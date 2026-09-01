// Stub for the `cloudflare:workers` built-in, which does not exist outside the
// Cloudflare Workers runtime. The Vercel/Nitro build only needs this to resolve;
// the code paths that use it never run on this preset.
export const env: Record<string, unknown> = {};
export class WorkerEntrypoint {}
export class DurableObject {}
export class RpcTarget {}
export const WorkflowEntrypoint = class {};
export function waitUntil(_p: Promise<unknown>): void {}
export default { env };
