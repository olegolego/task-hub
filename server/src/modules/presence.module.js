const presenceModule = {
  name: 'presence',
  messageTypes: ['user:status'],

  init(db) {},

  async handle(message, { broadcast, clients, clientInfo, ws }) {
    if (message.type === 'user:status') {
      broadcast({ type: 'user:status', userId: clientInfo.id, status: message.payload.status }, ws)
    }
  },
}

module.exports = presenceModule
