// Application registry: every app, and the default app whose menus show when
// no window is active. Each app is a directory under src/apps/.

import { FINDER } from '../state/shell.ts'
import type { AppId } from '../state/shell.ts'
import type { AppDefinition, AppDeps } from '../shell/menu-bar.ts'
import { finder } from './finder/index.ts'
import type { FinderActions } from './finder/index.ts'
import { textViewer } from './text-viewer/index.ts'
import type { TextViewerActions } from './text-viewer/index.ts'
import { desktopPatterns } from './desktop-patterns/index.ts'
import type { DesktopPatternsActions } from './desktop-patterns/index.ts'
import { fontViewer } from './font-viewer/index.ts'
import type { FontViewerActions } from './font-viewer/index.ts'

/** Each application's actions, which the others call through deps.apps. */
export interface AppActions {
  finder: FinderActions
  'text-viewer': TextViewerActions
  'desktop-patterns': DesktopPatternsActions
  'font-viewer': FontViewerActions
}

/** deps.apps: filled as each application's init returns, so read at pick
 *  time. */
export type Apps = Partial<AppActions>

export type Deps = AppDeps<Apps>

/** One application, whose init returns actions of type `A`. */
export interface App<A> extends AppDefinition<Apps> {
  init(args: { menus: HTMLElement[]; deps: Deps }): { actions: A; dispose(): void }
}

export const APPS: AppDefinition<Apps>[] = [finder, textViewer, desktopPatterns, fontViewer]

export const DEFAULT_APP: AppId = FINDER
