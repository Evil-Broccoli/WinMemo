import type {
  DesktopWindowKind,
  DesktopWindowState,
  SetAlwaysOnTopInput
} from '../../shared/desktop'
import type { AppResult } from '../../shared/result'

interface DesktopWindowLike {
  readonly id: number
  readonly isAlwaysOnTop: () => boolean
  readonly setAlwaysOnTop: (enabled: boolean) => void
}

interface WindowHandlerController {
  readonly getKind: (window: DesktopWindowLike) => DesktopWindowKind | undefined
  readonly onAlwaysOnTopChanged?: (state: DesktopWindowState) => void
}

export interface WindowHandlers {
  readonly getState: (
    window: DesktopWindowLike | undefined
  ) => AppResult<DesktopWindowState>
  readonly setAlwaysOnTop: (
    window: DesktopWindowLike | undefined,
    request: unknown
  ) => AppResult<DesktopWindowState>
}

const SET_ALWAYS_ON_TOP_FIELDS = ['enabled']

function success<Value>(value: Value): AppResult<Value> {
  return {
    ok: true,
    value
  }
}

function failure(
  code: 'validation-failed' | 'unknown',
  message: string
): AppResult<never> {
  return {
    ok: false,
    error: {
      code,
      message
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSetAlwaysOnTopInput(
  request: unknown
): AppResult<SetAlwaysOnTopInput> {
  if (
    !isRecord(request) ||
    !Object.keys(request).every((key) =>
      SET_ALWAYS_ON_TOP_FIELDS.includes(key)
    ) ||
    typeof request.enabled !== 'boolean'
  ) {
    return failure(
      'validation-failed',
      'A valid always-on-top setting is required.'
    )
  }

  return success({
    enabled: request.enabled
  })
}

function toDesktopWindowState(
  window: DesktopWindowLike,
  kind: DesktopWindowKind
): DesktopWindowState {
  return {
    id: window.id,
    kind,
    alwaysOnTop: window.isAlwaysOnTop()
  }
}

function getManagedWindowState(
  controller: WindowHandlerController,
  window: DesktopWindowLike | undefined
): AppResult<DesktopWindowState> {
  if (!window) {
    return failure('unknown', 'Unable to identify this desktop window.')
  }

  const kind = controller.getKind(window)

  if (!kind) {
    return failure('unknown', 'Unable to identify this desktop window.')
  }

  return success(toDesktopWindowState(window, kind))
}

export function createWindowHandlers(
  controller: WindowHandlerController
): WindowHandlers {
  return {
    getState: (window) => getManagedWindowState(controller, window),
    setAlwaysOnTop: (window, request) => {
      const input = parseSetAlwaysOnTopInput(request)

      if (!input.ok) {
        return input
      }

      if (!window) {
        return failure('unknown', 'Unable to identify this desktop window.')
      }

      const kind = controller.getKind(window)

      if (!kind) {
        return failure('unknown', 'Unable to identify this desktop window.')
      }

      try {
        window.setAlwaysOnTop(input.value.enabled)
      } catch {
        return failure('unknown', 'Unable to update this window.')
      }

      const state = toDesktopWindowState(window, kind)

      controller.onAlwaysOnTopChanged?.(state)

      return success(state)
    }
  }
}
