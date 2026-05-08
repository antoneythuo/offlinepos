// IPC handlers for settings management — Task 21.3, 32.1
// Channels: settings:get, settings:set, settings:getAll
// Requirements: 15.4, 22.7, 30.1, 30.5, 32.1

import { registerHandler } from '../../src/ipc/registerHandler'
import { settingsService } from '../../src/services/SettingsService'

export function registerSettingsHandlers(): void {
  // Retrieve a single setting value by key
  registerHandler('settings:get', async (payload: unknown) => {
    const { key } = payload as { key: string }
    const value = await settingsService.get(key)
    return value
  })

  // Persist a single setting value
  registerHandler('settings:set', async (payload: unknown) => {
    const { key, value } = payload as { key: string; value: string }
    await settingsService.set(key, value)
  })

  // Retrieve all settings as a flat key→value map
  registerHandler('settings:getAll', async (_payload: unknown) => {
    const all = await settingsService.getAll()
    return all
  })
}
