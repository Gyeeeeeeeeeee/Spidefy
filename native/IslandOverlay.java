package __PKG__;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Pil "Dynamic Island" yang melayang di atas aplikasi lain.
 * Tampil hanya kalau: fitur dinyalakan + app sedang di latar belakang (Home ditekan) + izin overlay diberikan.
 */
public class IslandOverlay {
  public interface Listener {
    void onAction(String action);
  }

  private static IslandOverlay instance;

  public static synchronized IslandOverlay get(Context c) {
    if (instance == null) instance = new IslandOverlay(c.getApplicationContext());
    return instance;
  }

  private final Context ctx;
  private final Handler ui = new Handler(Looper.getMainLooper());
  private WindowManager wm;
  private LinearLayout root;
  private TextView titleTv;
  private TextView lineTv;
  private LinearLayout controls;
  private TextView playTv;
  private WindowManager.LayoutParams params;
  private Listener listener;

  private boolean enabled = false;
  private boolean foreground = true;
  private boolean active = false;
  private boolean playing = false;
  private boolean expanded = false;
  private String title = "";
  private String artist = "";
  private String line = "";

  private IslandOverlay(Context c) {
    this.ctx = c;
  }

  public void setListener(Listener l) {
    this.listener = l;
  }

  public void setEnabled(boolean v) {
    enabled = v;
    refresh();
  }

  public void setForeground(boolean v) {
    foreground = v;
    if (v) expanded = false;
    refresh();
  }

  public void update(String t, String a, String l, boolean p, boolean act) {
    title = t == null ? "" : t;
    artist = a == null ? "" : a;
    line = l == null ? "" : l;
    playing = p;
    active = act;
    refresh();
  }

  public void shutdown() {
    enabled = false;
    refresh();
  }

  private int dp(int v) {
    return Math.round(v * ctx.getResources().getDisplayMetrics().density);
  }

  private boolean canDraw() {
    return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(ctx);
  }

  private void refresh() {
    ui.post(new Runnable() {
      @Override
      public void run() {
        try {
          boolean show = enabled && !foreground && active && canDraw();
          if (!show) {
            removeView();
            return;
          }
          if (root == null) createView();
          applyState();
        } catch (Exception e) {
          // abaikan supaya app tidak crash
        }
      }
    });
  }

  private void removeView() {
    if (root != null && wm != null) {
      try {
        wm.removeView(root);
      } catch (Exception e) {
        // abaikan
      }
    }
    root = null;
  }

  private TextView makeButton(String label, final String action) {
    TextView b = new TextView(ctx);
    b.setText(label);
    b.setTextColor(Color.WHITE);
    b.setTextSize(22);
    b.setGravity(Gravity.CENTER);
    b.setPadding(dp(18), dp(4), dp(18), dp(4));
    b.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        if (listener != null) listener.onAction(action);
      }
    });
    return b;
  }

  private void createView() {
    wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);

    root = new LinearLayout(ctx);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER_HORIZONTAL);
    root.setPadding(dp(18), dp(9), dp(18), dp(9));
    GradientDrawable bg = new GradientDrawable();
    bg.setColor(Color.BLACK);
    bg.setCornerRadius(dp(28));
    root.setBackground(bg);
    root.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        expanded = !expanded;
        applyState();
      }
    });

    titleTv = new TextView(ctx);
    titleTv.setTextColor(Color.parseColor("#9a9aa5"));
    titleTv.setTextSize(11);
    titleTv.setTypeface(Typeface.DEFAULT_BOLD);
    titleTv.setSingleLine(true);
    titleTv.setEllipsize(TextUtils.TruncateAt.END);
    titleTv.setMaxWidth(dp(280));
    titleTv.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        openApp();
      }
    });
    root.addView(titleTv);

    lineTv = new TextView(ctx);
    lineTv.setTextColor(Color.WHITE);
    lineTv.setTextSize(13);
    lineTv.setTypeface(Typeface.DEFAULT_BOLD);
    lineTv.setGravity(Gravity.CENTER);
    lineTv.setMaxWidth(dp(280));
    root.addView(lineTv);

    controls = new LinearLayout(ctx);
    controls.setOrientation(LinearLayout.HORIZONTAL);
    controls.setGravity(Gravity.CENTER);
    controls.addView(makeButton("\u23EE", "prev"));
    playTv = makeButton("\u23F8", "toggle");
    controls.addView(playTv);
    controls.addView(makeButton("\u23ED", "next"));
    root.addView(controls);

    int type = Build.VERSION.SDK_INT >= 26
        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        : WindowManager.LayoutParams.TYPE_PHONE;
    params = new WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        type,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
        PixelFormat.TRANSLUCENT);
    params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
    params.y = dp(8);

    wm.addView(root, params);
  }

  private void applyState() {
    if (root == null) return;
    boolean hasLine = line.length() > 0;
    String head = artist.length() > 0 ? title + " \u2013 " + artist : title;

    if (expanded) {
      titleTv.setVisibility(View.VISIBLE);
      titleTv.setText(head);
      lineTv.setVisibility(View.VISIBLE);
      lineTv.setText(hasLine ? line : "\u266A");
      lineTv.setSingleLine(false);
      lineTv.setMaxLines(3);
      controls.setVisibility(View.VISIBLE);
      playTv.setText(playing ? "\u23F8" : "\u25B6");
    } else {
      titleTv.setVisibility(View.GONE);
      controls.setVisibility(View.GONE);
      lineTv.setVisibility(View.VISIBLE);
      lineTv.setSingleLine(true);
      lineTv.setEllipsize(TextUtils.TruncateAt.END);
      lineTv.setText(hasLine && playing ? "\u266A " + line : "\u266A " + head);
    }
    try {
      wm.updateViewLayout(root, params);
    } catch (Exception e) {
      // abaikan
    }
  }

  private void openApp() {
    try {
      Intent i = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
      if (i != null) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        ctx.startActivity(i);
      }
    } catch (Exception e) {
      // abaikan
    }
  }
}
