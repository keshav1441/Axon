package expo.modules.axonnative

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Process
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import expo.modules.axonnative.bridge.AxonBridge
import expo.modules.axonnative.overlay.OverlayForegroundService
import expo.modules.axonnative.usage.AxonAccessibilityService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Every permission here is "dangerous" or "special" - none of them are
 * requested through a promise-resolving native dialog callback. Instead the
 * app opens the relevant system prompt/settings screen and the JS side
 * re-checks `hasXPermission()` when the app resumes (AppState -> 'active').
 * This avoids needing an ActivityResult bridge for a one-time, low-frequency
 * flow.
 */
class AxonNativeModule : Module() {

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No context")

  override fun definition() = ModuleDefinition {
    Name("AxonNative")

    Events(
      "onSmsReceived",
      "onUpiNotification",
      "onForegroundAppChanged",
      "onOverlayAction",
    )

    OnCreate {
      AxonBridge.emit = { event, payload -> sendEvent(event, payload) }
    }

    OnDestroy {
      AxonBridge.emit = null
    }

    // --- SMS -------------------------------------------------------------

    Function("hasSmsPermission") {
      ContextCompat.checkSelfPermission(context, android.Manifest.permission.RECEIVE_SMS) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    Function("requestSmsPermission") {
      appContext.currentActivity?.let {
        ActivityCompat.requestPermissions(
          it,
          arrayOf(android.Manifest.permission.RECEIVE_SMS, android.Manifest.permission.READ_SMS),
          0,
        )
      }
    }

    // --- Notification listener (UPI notifications) ------------------------

    Function("hasNotificationAccess") {
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
      enabled != null && enabled.contains(context.packageName)
    }

    Function("openNotificationAccessSettings") {
      context.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    // --- Overlay -----------------------------------------------------------

    Function("hasOverlayPermission") {
      Settings.canDrawOverlays(context)
    }

    Function("requestOverlayPermission") {
      context.startActivity(
        Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    // --- Accessibility / usage tracking -------------------------------------

    Function("hasAccessibilityServiceEnabled") {
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      )
      enabled != null && enabled.contains("${context.packageName}/${AxonAccessibilityService::class.java.name}")
    }

    Function("openAccessibilitySettings") {
      context.startActivity(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    Function("hasUsageAccess") {
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName,
      )
      mode == AppOpsManager.MODE_ALLOWED
    }

    Function("openUsageAccessSettings") {
      context.startActivity(
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    }

    // --- Focus config pushed down to the AccessibilityService/overlay ------

    Function("setDistractionApps") { packages: List<String> ->
      AxonBridge.distractionPackages = packages.toSet()
    }

    Function("setAppBudgetMinutes") { budgets: Map<String, Int> ->
      AxonBridge.budgetMinutesByPackage = budgets
    }

    Function("setNudgeIntervalMinutes") { minutes: Int ->
      AxonBridge.budgetMinutesByPackage =
        AxonBridge.budgetMinutesByPackage + ("_nudgeIntervalMinutes" to minutes)
    }

    Function("startFocusMode") {
      OverlayForegroundService.startFocusBlock(context)
    }

    Function("stopFocusMode") {
      OverlayForegroundService.stop(context)
    }

    Function("listInstalledApps") {
      val pm = context.packageManager
      val launchables = pm.queryIntentActivities(
        Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),
        0,
      )
      launchables
        .asSequence()
        .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
        .filter { (packageName, _) -> packageName != context.packageName }
        .distinctBy { it.first }
        .sortedBy { it.second.lowercase() }
        .map { (packageName, label) -> mapOf("packageName" to packageName, "label" to label) }
        .toList()
    }
  }
}
