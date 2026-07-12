package expo.modules.axonnative.bridge

/**
 * In-process pub/sub connecting Android components that can't hold a direct
 * reference to the live Expo module instance (BroadcastReceiver, Service)
 * back to it. The module sets [emit] in its OnCreate/OnDestroy lifecycle.
 *
 * Nothing posted through here is written to disk or logged - callers parse
 * the payload and let it go out of scope.
 */
object AxonBridge {
  var emit: ((event: String, payload: Map<String, Any?>) -> Unit)? = null

  var distractionPackages: Set<String> = emptySet()
  var budgetMinutesByPackage: Map<String, Int> = emptyMap()
  var focusModeActive: Boolean = false

  fun send(event: String, payload: Map<String, Any?>) {
    emit?.invoke(event, payload)
  }
}
