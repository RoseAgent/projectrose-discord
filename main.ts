import { registerHandlers } from './src/main/handlers'
import { connect as connectDiscord } from './src/main/service'
import { DISCORD_TOOLS } from './src/main/tools'
import type { ExtensionMainContext } from './src/main/types'

export function register(ctx: ExtensionMainContext): () => void {
  ctx.registerTools(DISCORD_TOOLS)
  const cleanup = registerHandlers(ctx)

  // Auto-connect at startup if a token is already configured. Without this,
  // agent tools and the Discord view stay broken until the user opens Settings,
  // because the bot client is only logged in via the rose-discord:connect IPC.
  void (async () => {
    try {
      const settings = await ctx.getSettings()
      const token = String((settings as Record<string, unknown>)['discordBotToken'] ?? '')
      if (!token) return
      await connectDiscord(token, (channelId, msg) => {
        ctx.broadcast('rose-discord:newMessage', { channelId, message: msg })
      })
    } catch (err) {
      console.error('[rose-discord] auto-connect failed:', err)
    }
  })()

  return cleanup
}
