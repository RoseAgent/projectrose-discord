// Tool implementations for rose-discord.
//
// Settings access goes through the contract: tools must NOT import host
// internals directly. `register(ctx)` in `main.ts` stashes the ctx via
// `setRoseDiscordCtx` so the tool execute functions can call
// `ctx.getSettings()` when invoked.

import { fetchDiscordChannels, fetchDiscordMessages, sendDiscordMessage } from './service'
import type {
  ExtensionToolEntry,
  ExtensionMainContext
} from '../../../../ProjectRose/src/shared/extension-contract'

let activeCtx: ExtensionMainContext | null = null

export function setRoseDiscordCtx(ctx: ExtensionMainContext): void {
  activeCtx = ctx
}

function requireCtx(): ExtensionMainContext {
  if (!activeCtx) {
    throw new Error('rose-discord: tool invoked before register(ctx) completed')
  }
  return activeCtx
}

interface DiscordSettings {
  discordBotToken?: string
  discordChannels?: string[]
}

async function loadDiscordSettings(): Promise<DiscordSettings> {
  const raw = (await requireCtx().getSettings()) as Record<string, unknown>
  return {
    discordBotToken: typeof raw.discordBotToken === 'string' ? raw.discordBotToken : undefined,
    discordChannels: Array.isArray(raw.discordChannels)
      ? raw.discordChannels.filter((v): v is string => typeof v === 'string')
      : undefined
  }
}

async function handleListDiscordChannels(): Promise<string> {
  const cfg = await loadDiscordSettings()
  const enabledIds = new Set(cfg.discordChannels ?? [])
  const all = await fetchDiscordChannels()
  const channels = enabledIds.size > 0 ? all.filter((c) => enabledIds.has(c.id)) : all
  if (channels.length === 0) return 'No Discord channels are enabled. Configure them in Settings > Discord.'
  const byGuild = channels.reduce<Record<string, typeof channels>>((acc, ch) => {
    (acc[ch.guildName] ??= []).push(ch)
    return acc
  }, {})
  return Object.entries(byGuild).map(([guild, chs]) =>
    `Server: ${guild}\n${chs.map(c => `  #${c.name} (ID: ${c.id})`).join('\n')}`
  ).join('\n\n')
}

async function handleReadDiscordMessages(input: Record<string, unknown>): Promise<string> {
  const channelId = String(input.channelId || '')
  const limit = Math.min(Number(input.limit) || 20, 100)
  if (!channelId) return 'Missing channelId parameter.'
  const cfg = await loadDiscordSettings()
  if (!cfg.discordBotToken) return 'Discord not configured. Set a bot token in Settings.'
  const messages = await fetchDiscordMessages(channelId, limit)
  if (messages.length === 0) return 'No messages found in that channel.'
  return messages.map(m => {
    const ts = new Date(m.timestamp).toLocaleString()
    let line = `[${ts}] @${m.authorUsername}: ${m.content}`
    if (m.attachments.length > 0) line += ` [${m.attachments.map(a => a.filename).join(', ')}]`
    if (m.embeds.length > 0) line += ` [embed: ${m.embeds.map(e => e.title || 'untitled').join(', ')}]`
    return line
  }).join('\n')
}

async function handleSendDiscordMessage(input: Record<string, unknown>): Promise<string> {
  const channelId = String(input.channelId || '')
  const content = String(input.content || '')
  if (!channelId || !content) return 'Missing channelId or content parameter.'
  await sendDiscordMessage(channelId, content)
  return `Message sent to channel ${channelId}.`
}

export const DISCORD_TOOLS: ExtensionToolEntry[] = [
  {
    name: 'list_discord_channels',
    description: 'List all Discord channels the bot has access to, grouped by server. Returns channel names and IDs needed for reading or sending messages.',
    schema: {
      type: 'object',
      properties: {}
    },
    execute: handleListDiscordChannels
  },
  {
    name: 'read_discord_messages',
    description: 'Read recent messages from a Discord channel. Returns messages with author, timestamp, and content.',
    schema: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'The Discord channel ID' },
        limit: { type: 'number', description: 'Number of messages to fetch (default 20, max 100)' }
      },
      required: ['channelId']
    },
    execute: handleReadDiscordMessages
  },
  {
    name: 'send_discord_message',
    description: 'Send a message to a Discord channel.',
    schema: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'The Discord channel ID' },
        content: { type: 'string', description: 'The message text to send' }
      },
      required: ['channelId', 'content']
    },
    execute: handleSendDiscordMessage
  }
]
