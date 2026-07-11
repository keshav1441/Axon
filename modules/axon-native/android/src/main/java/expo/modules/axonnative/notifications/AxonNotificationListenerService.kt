package expo.modules.axonnative.notifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import expo.modules.axonnative.bridge.AxonBridge

/**
 * Only inspects notifications from a small allow-list of payment apps -
 * everything else is ignored at the source. Title/text are forwarded to JS
 * for parsing and are not retained here.
 */
class AxonNotificationListenerService : NotificationListenerService() {

  companion object {
    val WATCHED_PACKAGES = setOf(
      "com.google.android.apps.nbu.paisa.user", // Google Pay
      "com.phonepe.app",
      "net.one97.paytm",
      "in.org.npci.upiapp", // BHIM
      "com.dreamplug.androidapp", // CRED
    )
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName !in WATCHED_PACKAGES) return

    val extras = sbn.notification.extras
    val title = extras.getCharSequence("android.title")?.toString() ?: return
    val text = extras.getCharSequence("android.text")?.toString() ?: return

    AxonBridge.send(
      "onUpiNotification",
      mapOf(
        "packageName" to sbn.packageName,
        "title" to title,
        "text" to text,
        "timestampMs" to sbn.postTime,
      ),
    )
  }
}
