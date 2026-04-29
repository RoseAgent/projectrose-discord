export interface ExtensionToolEntry {
  name: string
  description: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>
  execute: (input: Record<string, unknown>, projectRoot: string) => Promise<string>
}

export type HookType = 'on_thought' | 'on_message' | 'on_tool_call'

export type HookEvent =
  | { type: 'on_thought'; content: string; turnId: string }
  | { type: 'on_message'; content: string; turnId: string }
  | { type: 'on_tool_call'; toolName: string; params: Record<string, unknown>; result: string; error: boolean; turnId: string }

export interface ChatHook {
  type: HookType
  handler: (event: HookEvent) => Promise<{ inject?: string } | void> | { inject?: string } | void
  allowMultiple?: boolean
}

export interface AgentSession {
  send: (text: string) => Promise<string>
  close: () => void
}

export interface ExtensionMainContext {
  getSettings: () => Promise<Record<string, unknown>>
  updateSettings: (patch: Record<string, unknown>) => Promise<void>
  broadcast: (channel: string, data: unknown) => void
  registerTools: (tools: ExtensionToolEntry[]) => void
  registerHooks: (hooks: ChatHook[]) => void
  openAgentSession: (opts: { systemPrompt: string }) => AgentSession
}
