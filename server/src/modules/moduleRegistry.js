const tasksModule = require('./tasks.module')
const ideasModule = require('./ideas.module')
const groupsModule = require('./groups.module')
const presenceModule = require('./presence.module')

const MODULES = [tasksModule, ideasModule, groupsModule, presenceModule]

const moduleRegistry = {
  loadAll(db) {
    for (const mod of MODULES) {
      if (mod.init) mod.init(db)
      console.log(`[Registry] Loaded module: ${mod.name}`)
    }
  },

  async handle(message, context) {
    for (const mod of MODULES) {
      if (mod.messageTypes.some(t =>
        message.type === t ||
        (t.endsWith(':*') && message.type.startsWith(t.slice(0, -1)))
      )) {
        await mod.handle(message, context)
        return
      }
    }
    console.warn('[Registry] Unhandled message type:', message.type)
  },
}

module.exports = { moduleRegistry }
