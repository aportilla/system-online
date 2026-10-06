// Meteors: an Asteroids-style game. Its icon on the desktop opens one fixed
// window, centered, out of the icon and on the title screen (windows.ts); it
// closes back into the icon. Q or Escape in a game asks whether to end it
// (dialogs.html); ending it goes back to the title screen.

import type { VfViewportBox, VfWindow } from 'vintage-frames'
import { centeredBox, defineApp } from 'vintage-frames/shell'
import type { AppDefinition } from 'vintage-frames/shell'
import menus from './menus.html?raw'
import dialogs from './dialogs.html?raw'
import windowMarkup from './windows.html?raw'
import icon from './art/meteors.png'
import { gameWindow } from './windows.ts'

export const METEORS = 'meteors'

export interface MeteorsActions {
  /** Open the game's window out of `from`, or bring it forward. Its icon
   *  opens it through this. */
  open(target: { from?: VfViewportBox | null }): void
}

export function meteors(): AppDefinition<MeteorsActions> {
  return defineApp<MeteorsActions>({
    id: METEORS,
    name: 'Meteors',
    icon,
    menus,
    dialogs,
    windows: windowMarkup,
    init(ctx) {
      const { desktop, windows } = ctx
      const endGame = ctx.dialog('end-game')
      /** The game's window, while it is open. */
      let game: VfWindow | null = null

      const quit = () => void windows.closeAll(METEORS)

      ctx.onMenu((value) => {
        if (value === 'close' && game?.isConnected) void windows.requestClose(game)
        else if (value === 'quit') quit()
        else if (value === 'arrange') windows.arrange()
      })
      ctx.gate(ctx.item('arrange'), () => !windows.arranged())

      return {
        open({ from = null }) {
          if (game?.isConnected) {
            desktop.bringToFront(game)
            return
          }
          const win = gameWindow(ctx.window('game'), {
            quit,
            confirmEnd: async () => (await ctx.ask(endGame)) === 'end',
          })
          const size = { width: win.width ?? 0, height: win.height ?? 0 }
          game = windows.open({ app: METEORS, from, create: () => win, place: (area) => centeredBox(area, size) })
        },
      }
    },
  })
}
