package expo.modules.axonnative.overlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.CountDownTimer
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import expo.modules.axonnative.bridge.AxonBridge
import expo.modules.axonnative.usage.AxonAccessibilityService

/**
 * Draws the floating session pill + nudge popups over whatever app is in
 * the foreground. Runs as a foreground service so Android doesn't kill the
 * overlay mid-session.
 */
class OverlayForegroundService : Service() {

  companion object {
    private const val CHANNEL_ID = "axon_focus_overlay"
    private const val NOTIFICATION_ID = 4201
    private const val EXTRA_PACKAGE = "package"
    private const val EXTRA_MODE = "mode"
    private const val MODE_PILL = "pill"
    private const val MODE_FOCUS_BLOCK = "focus_block"

    fun start(context: Context, packageName: String) {
      val intent = Intent(context, OverlayForegroundService::class.java)
        .putExtra(EXTRA_PACKAGE, packageName)
        .putExtra(EXTRA_MODE, MODE_PILL)
      context.startForegroundService(intent)
    }

    fun startFocusBlock(context: Context) {
      val intent = Intent(context, OverlayForegroundService::class.java)
        .putExtra(EXTRA_MODE, MODE_FOCUS_BLOCK)
      context.startForegroundService(intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, OverlayForegroundService::class.java))
    }
  }

  private lateinit var windowManager: WindowManager
  private var pillView: View? = null
  private var nudgeView: View? = null

  private var currentPackage: String = ""
  private var sessionStartMs: Long = 0
  private var nudgeCount: Int = 0
  private var tickTimer: CountDownTimer? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(NOTIFICATION_ID, buildNotification())

    if (!Settings.canDrawOverlays(this)) {
      stopSelf()
      return START_NOT_STICKY
    }

    val mode = intent?.getStringExtra(EXTRA_MODE) ?: MODE_PILL
    if (mode == MODE_FOCUS_BLOCK) {
      showFocusBlock()
    } else {
      val packageName = intent?.getStringExtra(EXTRA_PACKAGE) ?: ""
      if (packageName != currentPackage) {
        currentPackage = packageName
        sessionStartMs = System.currentTimeMillis()
        nudgeCount = 0
      }
      showPill()
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    super.onDestroy()
    removeAllViews()
    tickTimer?.cancel()
  }

  // --- Pill -----------------------------------------------------------

  private fun showPill() {
    removeView(nudgeView)
    nudgeView = null

    if (pillView == null) {
      pillView = buildPillView()
      val params = overlayParams(width = WindowManager.LayoutParams.WRAP_CONTENT)
      params.gravity = Gravity.TOP or Gravity.START
      params.x = 24
      params.y = 120
      makeDraggable(pillView!!, params)
      windowManager.addView(pillView, params)
    }

    tickTimer?.cancel()
    tickTimer = object : CountDownTimer(Long.MAX_VALUE, 1000) {
      override fun onTick(millisUntilFinished: Long) = updatePillText()
      override fun onFinish() {}
    }.also { it.start() }
  }

  private fun updatePillText() {
    val pill = pillView as? LinearLayout ?: return
    val label = pill.getChildAt(0) as? TextView ?: return
    val elapsedSec = ((System.currentTimeMillis() - sessionStartMs) / 1000).toInt()
    val mins = elapsedSec / 60
    val secs = elapsedSec % 60
    label.text = String.format("%s · %02d:%02d", shortName(currentPackage), mins, secs)

    val budget = AxonBridge.budgetMinutesByPackage[currentPackage]
    val bg = pill.background as? GradientDrawable
    if (budget != null && mins >= budget) {
      bg?.setColor(Color.parseColor("#B3261E"))
    } else {
      bg?.setColor(Color.parseColor("#1A1B1E"))
    }

    val nudgeEveryMin = AxonBridge.budgetMinutesByPackage["_nudgeIntervalMinutes"] ?: 5
    if (mins > 0 && mins % nudgeEveryMin == 0 && secs == 0) {
      showNudge()
    }
  }

  private fun shortName(packageName: String) = packageName.substringAfterLast('.').take(12)

  // --- Nudge ------------------------------------------------------------

  private fun showNudge() {
    if (nudgeView != null) return
    nudgeCount += 1

    val dismissDelayMs = (nudgeCount * 1200L).coerceAtMost(6000L)
    val view = buildNudgeView(dismissDelayMs)
    val params = overlayParams(width = WindowManager.LayoutParams.MATCH_PARENT)
    params.gravity = Gravity.CENTER
    nudgeView = view
    windowManager.addView(view, params)
  }

  private fun dismissNudge(action: String) {
    removeView(nudgeView)
    nudgeView = null
    AxonBridge.send("onOverlayAction", mapOf("action" to action, "packageName" to currentPackage))
    if (action == "close_app") {
      AxonAccessibilityService.instance?.goHome()
    }
  }

  // --- Focus Mode block ---------------------------------------------------

  private fun showFocusBlock() {
    removeAllViews()
    tickTimer?.cancel()
    val view = buildFocusBlockView()
    val params = overlayParams(width = WindowManager.LayoutParams.MATCH_PARENT)
    params.gravity = Gravity.CENTER
    pillView = view
    windowManager.addView(view, params)
  }

  // --- View builders (programmatic, no XML layouts) ------------------------

  private fun buildPillView(): View {
    val label = TextView(this).apply {
      setTextColor(Color.WHITE)
      textSize = 13f
      setPadding(28, 16, 28, 16)
    }
    return LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      background = pillDrawable()
      addView(label)
    }
  }

  private fun pillDrawable() = GradientDrawable().apply {
    cornerRadius = 999f
    setColor(Color.parseColor("#1A1B1E"))
  }

  private fun buildNudgeView(dismissDelayMs: Long): View {
    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.parseColor("#99000000"))
    }
    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(48, 48, 48, 48)
      background = GradientDrawable().apply {
        cornerRadius = 32f
        setColor(Color.parseColor("#212225"))
      }
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.CENTER,
      )
    }
    val title = TextView(this).apply {
      text = "Still on ${shortName(currentPackage)}?"
      setTextColor(Color.WHITE)
      textSize = 18f
      setPadding(0, 0, 0, 32)
    }
    card.addView(title)

    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    val keepGoing = Button(this).apply {
      text = "Keep going"
      isEnabled = false
      setOnClickListener { dismissNudge("keep_going") }
    }
    val closeApp = Button(this).apply {
      text = "Close app"
      setOnClickListener { dismissNudge("close_app") }
    }
    val snooze = Button(this).apply {
      text = "Snooze"
      setOnClickListener { dismissNudge("snooze") }
    }
    row.addView(keepGoing)
    row.addView(closeApp)
    row.addView(snooze)
    card.addView(row)
    root.addView(card)

    // Escalating friction: "Keep going" stays disabled for longer on later nudges.
    keepGoing.postDelayed({ keepGoing.isEnabled = true }, dismissDelayMs)

    return root
  }

  private val focusQuotes = listOf(
    "Discipline is choosing between what you want now and what you want most.",
    "The successful warrior is the average person with laser-like focus.",
    "You don't have to see the whole staircase, just take the first step.",
    "Small disciplines repeated with consistency lead to great achievements.",
    "Focus on being productive instead of busy.",
    "What you do today can improve all your tomorrows.",
    "Almost everything will work again if you unplug it for a few minutes, including you.",
  )

  /** No dismiss button by design - leaving this app (home/back) or reopening Axon to stop Focus Mode are the only exits. */
  private fun buildFocusBlockView(): View {
    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.parseColor("#F5000000"))
    }
    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(56, 56, 56, 56)
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.CENTER,
      )
    }
    val title = TextView(this).apply {
      text = "Focus Mode is on"
      setTextColor(Color.WHITE)
      textSize = 22f
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 32)
    }
    val quote = TextView(this).apply {
      text = "“${focusQuotes.random()}”"
      setTextColor(Color.parseColor("#D0D0D0"))
      textSize = 16f
      gravity = Gravity.CENTER
    }
    card.addView(title)
    card.addView(quote)
    root.addView(card)
    return root
  }

  // --- Window plumbing -----------------------------------------------------

  private fun overlayParams(width: Int) = WindowManager.LayoutParams(
    width,
    WindowManager.LayoutParams.WRAP_CONTENT,
    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
    android.graphics.PixelFormat.TRANSLUCENT,
  )

  private fun makeDraggable(view: View, params: WindowManager.LayoutParams) {
    var startX = 0
    var startY = 0
    var touchX = 0f
    var touchY = 0f
    view.setOnTouchListener { _, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          startX = params.x
          startY = params.y
          touchX = event.rawX
          touchY = event.rawY
          true
        }
        MotionEvent.ACTION_MOVE -> {
          params.x = startX + (event.rawX - touchX).toInt()
          params.y = startY + (event.rawY - touchY).toInt()
          windowManager.updateViewLayout(view, params)
          true
        }
        else -> false
      }
    }
  }

  private fun removeView(view: View?) {
    if (view != null) {
      runCatching { windowManager.removeView(view) }
    }
  }

  private fun removeAllViews() {
    removeView(pillView)
    removeView(nudgeView)
    pillView = null
    nudgeView = null
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Focus overlay",
        NotificationManager.IMPORTANCE_MIN,
      )
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification {
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      PendingIntent.FLAG_IMMUTABLE
    } else {
      0
    }
    val openApp = PendingIntent.getActivity(
      this,
      0,
      packageManager.getLaunchIntentForPackage(packageName),
      flags,
    )
    return Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("Axon Focus is active")
      .setSmallIcon(android.R.drawable.ic_menu_recent_history)
      .setContentIntent(openApp)
      .setOngoing(true)
      .build()
  }
}
