import type Database from 'better-sqlite3'
import type { ServerModule, ModuleContext } from './types.js'
import { createLogger } from '../utils/logger.js'

import tasksModule from './tasks.module.js'
import ideasModule from './ideas.module.js'
import groupsModule from './groups.module.js'
import presenceModule from './presence.module.js'
import messagesModule from './messages.module.js'
import companyFilesModule from './companyFiles.module.js'
import groupChatModule from './groupChat.module.js'
import meetingsModule from './meetings.module.js'
import llmModule from './llm.module.js'
import llmChatModule from './llmChat.module.js'

const log = createLogger('registry')

const MODULES: ServerModule[] = [
  tasksModule,
  ideasModule,
  groupsModule,
  presenceModule,
  messagesModule,
  companyFilesModule,
  groupChatModule,
  meetingsModule,
  llmModule,
  llmChatModule,
]

export const moduleRegistry = {
  loadAll(db: Database.Database) {
    for (const mod of MODULES) {
      mod.init(db)
      log.info(`Loaded module: ${mod.name}`)
    }
  },

  async handle(message: { type: string; payload?: unknown }, context: ModuleContext) {
    for (const mod of MODULES) {
      if (
        mod.messageTypes.some(
          (t) =>
            message.type === t || (t.endsWith(':*') && message.type.startsWith(t.slice(0, -1))),
        )
      ) {
        await mod.handle(message, context)
        return
      }
    }
    log.warn('Unhandled message type', message.type)
  },
}
