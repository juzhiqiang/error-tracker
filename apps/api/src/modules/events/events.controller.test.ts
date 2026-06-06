import { describe, expect, it, mock } from 'bun:test'

mock.module('../../common/guards/session.guard', () => ({
  SessionGuard: class SessionGuard {},
}))

describe('EventsController access control', () => {
  it('checks event access before returning an event detail row', async () => {
    const event = { id: 'event-1', projectId: 'project-1' }
    const eventsService = { findById: mock(async () => event) }
    const access = { canAccessEvent: mock(async () => true) }
    const { EventsController } = await import('./events.controller')
    const controller = new EventsController(eventsService as never, access as never)
    const req = { session: { user: { id: 'user-1' } } }

    await expect(controller.findOne('event-1', req)).resolves.toEqual(event)

    expect(access.canAccessEvent.mock.calls[0]).toEqual(['user-1', 'event-1', ['viewer']])
  })

  it('does not read replay data when event access is denied', async () => {
    const eventsService = { findReplayByEventId: mock(async () => ({ events: [] })) }
    const access = { canAccessEvent: mock(async () => false) }
    const { EventsController } = await import('./events.controller')
    const controller = new EventsController(eventsService as never, access as never)
    const req = { session: { user: { id: 'user-1' } } }

    await expect(controller.replay('event-1', req)).rejects.toThrow('Event access denied')
    expect(eventsService.findReplayByEventId).not.toHaveBeenCalled()
  })
})
