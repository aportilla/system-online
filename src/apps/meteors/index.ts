// Meteors: an Asteroids-style game. Its icon on the desktop opens one fixed
// window, centered, out of the icon and on the title screen (windows.ts); it
// closes back into the icon. The window shows Meteors' own key, so the session
// keeps it and a reload reopens it, on the title screen. Q or Escape in a game
// asks whether to end it (dialogs.html); ending it goes back to the title
// screen. The best score is kept with the session, under BEST.

import type { VfViewportBox, VfWindow } from 'vintage-frames'
import { centeredBox, defineApp } from 'vintage-frames/shell'
import type { AppDefinition } from 'vintage-frames/shell'
import menus from './menus.html?raw'
import dialogs from './dialogs.html?raw'
import windowMarkup from './windows.html?raw'
import icon from './art/meteors.png'
import alertArt from './art/alert.png'
import { bestOf } from './game.ts'
import { gameWindow } from './windows.ts'

export const METEORS = 'meteors'

/** The session key that keeps the best score. */
const BEST = 'meteors-best'

export interface MeteorsActions {
  /** Open the game's window out of `from`, or bring it forward. Its icon
   *  opens it through this, and the boot reopens the last session's. */
  open(target: { item?: string | null; from?: VfViewportBox | null }): void
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
      const { desktop, windows, state } = ctx
      const endGame = ctx.dialog('end-game')
      // The alert's art is Meteors' own, set here: a ?raw fragment can't name
      // an imported file.
      endGame.querySelector('img')!.src = alertArt
      /** The best score, as the session keeps it. */
      const best = () => bestOf(state?.get(BEST))
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
            best,
            record: (score) => {
              if (score > best()) state?.set(BEST, score)
            },
          })
          const size = { width: win.width ?? 0, height: win.height ?? 0 }
          // The window's item is Meteors' own key: the session keeps a window
          // by its item, and closing falls back to the application's icon.
          game = windows.open({
            app: METEORS,
            item: METEORS,
            from,
            create: () => win,
            place: (area) => centeredBox(area, size),
          })
        },
      }
    },
  })
}
