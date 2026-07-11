package expo.modules.axonnative.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import expo.modules.axonnative.bridge.AxonBridge

/**
 * Forwards incoming SMS straight to JS for parsing and is done - the body
 * string is never written to a field, a log, or disk from this class.
 */
class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    for (message in messages) {
      val sender = message.originatingAddress ?: continue
      val body = message.messageBody ?: continue
      AxonBridge.send(
        "onSmsReceived",
        mapOf(
          "sender" to sender,
          "body" to body,
          "timestampMs" to message.timestampMillis,
        ),
      )
    }
  }
}
