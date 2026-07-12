package expo.modules.axonnative.usage

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import expo.modules.axonnative.bridge.AxonBridge
import expo.modules.axonnative.overlay.OverlayForegroundService

/**
 * Only reacts to window-state-change events (which package moved to the
 * foreground) - `canRetrieveWindowContent` is off in the service config, so
 * this never sees on-screen text/content from other apps.
 */
class AxonAccessibilityService : AccessibilityService() {

  private var lastPackage: String? = null

  companion object {
    var instance: AxonAccessibilityService? = null
      private set
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
  }

  override fun onDestroy() {
    super.onDestroy()
    if (instance === this) instance = null
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val packageName = event.packageName?.toString() ?: return
    if (packageName == lastPackage) return
    lastPackage = packageName

    val now = System.currentTimeMillis()
    AxonBridge.send(
      "onForegroundAppChanged",
      mapOf("packageName" to packageName, "timestampMs" to now),
    )

    if (AxonBridge.focusModeActive) {
      if (packageName in AxonBridge.distractionPackages) {
        OverlayForegroundService.startFocusBlock(applicationContext)
      } else {
        OverlayForegroundService.stop(applicationContext)
      }
    } else if (packageName in AxonBridge.distractionPackages) {
      OverlayForegroundService.start(applicationContext, packageName)
    } else {
      OverlayForegroundService.stop(applicationContext)
    }
  }

  override fun onInterrupt() {}

  /** Used by the "Close app" nudge action to kick the user back to the home screen. */
  fun goHome() {
    performGlobalAction(GLOBAL_ACTION_HOME)
  }
}
