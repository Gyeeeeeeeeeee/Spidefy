package __PKG__;

import android.animation.ValueAnimator;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.WindowManager;
import android.view.animation.Interpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;

/**
 * Dynamic Island: pil melayang di atas layar (muncul saat app ditinggal), bisa dibuka jadi kartu musik.
 * Animasi memakai pegas (spring) supaya halus. Juga memicu layar lirik di layar kunci.
 */
public class IslandOverlay {
  public interface Listener {
    void onAction(String action);
  }

  public interface StateObserver {
    void onState();
  }

  /** Gerakan pegas halus dengan sedikit membal, seperti animasi macOS / iOS. */
  private static class Spring implements Interpolator {
    @Override
    public float getInterpolation(float t) {
      if (t >= 1f) return 1f;
      double zeta = 0.74;
      double wn = 13.0;
      double wd = wn * Math.sqrt(1.0 - zeta * zeta);
      double e = Math.exp(-zeta * wn * t);
      return (float) (1.0 - e * (Math.cos(wd * t) + (zeta * wn / wd) * Math.sin(wd * t)));
    }
  }

  private static final Interpolator SPRING = new Spring();
  private static IslandOverlay instance;

  public static synchronized IslandOverlay get(Context c) {
    if (instance == null) instance = new IslandOverlay(c.getApplicationContext());
    return instance;
  }

  private final Context ctx;
  private final Handler ui = new Handler(Looper.getMainLooper());
  private final ArrayList<StateObserver> observers = new ArrayList<StateObserver>();
  private WindowManager wm;
  private Listener listener;

  // ---- state yang juga dibaca LockLyricsActivity ----
  public String title = "";
  public String artist = "";
  public String line = "";
  public String[] lines = new String[] { "", "", "", "", "" };
  public boolean playing = false;
  public boolean active = false;
  public double posSec = 0;
  public double durSec = 0;
  public long posStamp = 0;
  public String theme = "spidey";
  public Bitmap cover = null;

  private boolean enabled = false;
  private boolean foreground = true;
  private boolean lockEnabled = false;
  private boolean expanded = false;
  private String coverUrl = "";
  private String loadedUrl = "";
  private String appliedTheme = "";
  private BroadcastReceiver screenReceiver;

  // ---- view ----
  private FrameLayout root;
  private GradientDrawable bg;
  private LinearLayout compact;
  private LinearLayout expandedBox;
  private ImageView compactCover;
  private ImageView expandedCover;
  private TextView compactTitle;
  private TextView expTitle;
  private TextView expArtist;
  private TextView lyricTv;
  private TextView elapsedTv;
  private TextView remainTv;
  private IslandViews.ChibiView chibiCompact;
  private IslandViews.ChibiView chibiExpanded;
  private IslandViews.EqView eqCompact;
  private IslandViews.EqView eqExpanded;
  private IslandViews.ProgressView progressView;
  private IslandViews.IconView prevIv;
  private IslandViews.IconView playIv;
  private IslandViews.IconView nextIv;
  private FrameLayout playWrap;
  private GradientDrawable playBg;
  private WindowManager.LayoutParams params;
  private ValueAnimator anim;
  private boolean hiding = false;
  private float prog = 0f;
  private float radiusPx = 0f;
  private int compactW;
  private int compactH;
  private int expandedW;
  private int expandedH;

  private final Runnable tick = new Runnable() {
    @Override
    public void run() {
      if (root == null) return;
      updateProgress();
      ui.postDelayed(this, 400);
    }
  };

  private IslandOverlay(Context c) {
    this.ctx = c;
  }

  public void setListener(Listener l) {
    this.listener = l;
  }

  public void dispatch(String action) {
    if (listener != null) listener.onAction(action);
  }

  public void addObserver(StateObserver o) {
    if (!observers.contains(o)) observers.add(o);
  }

  public void removeObserver(StateObserver o) {
    observers.remove(o);
  }

  private void notifyObservers() {
    ArrayList<StateObserver> copy = new ArrayList<StateObserver>(observers);
    for (StateObserver o : copy) {
      try {
        o.onState();
      } catch (Exception e) {
        // abaikan
      }
    }
  }

  public double currentPos() {
    double p = posSec;
    if (playing) p += (SystemClock.elapsedRealtime() - posStamp) / 1000.0;
    if (durSec > 0 && p > durSec) p = durSec;
    return Math.max(0, p);
  }

  public static String fmt(double sec) {
    int s = (int) Math.max(0, Math.round(sec));
    int m = s / 60;
    int r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
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

  public void setTheme(final String t) {
    ui.post(new Runnable() {
      @Override
      public void run() {
        theme = "dark".equals(t) ? "dark" : "spidey";
        doRefresh();
        notifyObservers();
      }
    });
  }

  public void setLockLyrics(boolean v) {
    lockEnabled = v;
    ui.post(new Runnable() {
      @Override
      public void run() {
        ensureReceiver();
      }
    });
  }

  public void update(final String t, final String a, final String cUrl, final String l, final String[] ls,
      final boolean p, final boolean act, final double pos, final double dur) {
    ui.post(new Runnable() {
      @Override
      public void run() {
        title = t == null ? "" : t;
        artist = a == null ? "" : a;
        line = l == null ? "" : l;
        for (int i = 0; i < 5; i++) {
          lines[i] = (ls != null && i < ls.length && ls[i] != null) ? ls[i] : "";
        }
        playing = p;
        active = act;
        posSec = pos;
        durSec = dur;
        posStamp = SystemClock.elapsedRealtime();
        coverUrl = cUrl == null ? "" : cUrl;
        loadCover(coverUrl);
        doRefresh();
        notifyObservers();
      }
    });
  }

  public void shutdown() {
    enabled = false;
    lockEnabled = false;
    ui.post(new Runnable() {
      @Override
      public void run() {
        ensureReceiver();
        removeViewNow();
      }
    });
  }

  private int dp(int v) {
    return Math.round(v * ctx.getResources().getDisplayMetrics().density);
  }

  private boolean canDraw() {
    return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(ctx);
  }

  private static float clamp01(float v) {
    return Math.max(0f, Math.min(1f, v));
  }

  // ---------------- cover ----------------

  private void loadCover(final String url) {
    if (url.length() == 0) {
      loadedUrl = "";
      cover = null;
      applyCover();
      return;
    }
    if (url.equals(loadedUrl)) return;
    loadedUrl = url;
    new Thread(new Runnable() {
      @Override
      public void run() {
        Bitmap b = null;
        try {
          HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
          c.setConnectTimeout(8000);
          c.setReadTimeout(8000);
          InputStream in = c.getInputStream();
          b = BitmapFactory.decodeStream(in);
          in.close();
        } catch (Exception e) {
          b = null;
        }
        final Bitmap fb = b;
        ui.post(new Runnable() {
          @Override
          public void run() {
            if (!url.equals(loadedUrl)) return;
            cover = fb;
            applyCover();
            notifyObservers();
          }
        });
      }
    }).start();
  }

  private void applyCover() {
    if (compactCover != null) compactCover.setImageBitmap(cover);
    if (expandedCover != null) expandedCover.setImageBitmap(cover);
  }

  // ---------------- lock screen ----------------

  private void ensureReceiver() {
    if (lockEnabled && screenReceiver == null) {
      screenReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
          if (i != null && Intent.ACTION_SCREEN_ON.equals(i.getAction())) maybeShowLock();
        }
      };
      IntentFilter f = new IntentFilter(Intent.ACTION_SCREEN_ON);
      try {
        if (Build.VERSION.SDK_INT >= 33) {
          ctx.registerReceiver(screenReceiver, f, Context.RECEIVER_EXPORTED);
        } else {
          ctx.registerReceiver(screenReceiver, f);
        }
      } catch (Exception e) {
        screenReceiver = null;
      }
    } else if (!lockEnabled && screenReceiver != null) {
      try {
        ctx.unregisterReceiver(screenReceiver);
      } catch (Exception e) {
        // abaikan
      }
      screenReceiver = null;
    }
  }

  private void maybeShowLock() {
    if (!lockEnabled || !active || !playing || foreground || !canDraw()) return;
    try {
      KeyguardManager km = (KeyguardManager) ctx.getSystemService(Context.KEYGUARD_SERVICE);
      if (km == null || !km.isKeyguardLocked()) return;
      Intent i = new Intent(ctx, LockLyricsActivity.class);
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION
          | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
      ctx.startActivity(i);
    } catch (Exception e) {
      // abaikan
    }
  }

  // ---------------- tampil / sembunyi ----------------

  private void refresh() {
    ui.post(new Runnable() {
      @Override
      public void run() {
        doRefresh();
      }
    });
  }

  private void doRefresh() {
    try {
      boolean show = enabled && !foreground && active && canDraw();
      if (!show) {
        hideView();
        return;
      }
      if (root == null) {
        createView();
      } else if (hiding) {
        cancelHide();
      }
      applyTheme();
      applyState();
    } catch (Exception e) {
      // abaikan supaya app tidak crash
    }
  }

  private void cancelHide() {
    hiding = false;
    root.animate().cancel();
    root.setAlpha(1f);
    root.setScaleX(1f);
    root.setScaleY(1f);
    ui.removeCallbacks(tick);
    ui.post(tick);
  }

  private void hideView() {
    if (root == null || hiding) return;
    hiding = true;
    ui.removeCallbacks(tick);
    root.setPivotX(root.getWidth() / 2f);
    root.setPivotY(0f);
    root.animate().alpha(0f).scaleX(0.82f).scaleY(0.82f).setDuration(200).withEndAction(new Runnable() {
      @Override
      public void run() {
        if (hiding) removeViewNow();
      }
    });
  }

  private void removeViewNow() {
    ui.removeCallbacks(tick);
    if (anim != null) anim.cancel();
    anim = null;
    if (root != null && wm != null) {
      try {
        wm.removeView(root);
      } catch (Exception e) {
        // abaikan
      }
    }
    root = null;
    hiding = false;
    appliedTheme = "";
  }

  // ---------------- membangun view ----------------

  private ImageView makeCover(final int radius) {
    ImageView iv = new ImageView(ctx);
    iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
    iv.setBackgroundColor(Color.parseColor("#33FFFFFF"));
    iv.setOutlineProvider(new ViewOutlineProvider() {
      @Override
      public void getOutline(View v, Outline o) {
        o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), radius);
      }
    });
    iv.setClipToOutline(true);
    return iv;
  }

  private TextView makeText(int sp, boolean bold, int color) {
    TextView t = new TextView(ctx);
    t.setTextSize(sp);
    t.setTextColor(color);
    t.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
    t.setSingleLine(true);
    t.setEllipsize(TextUtils.TruncateAt.END);
    t.setIncludeFontPadding(false);
    return t;
  }

  private void createView() {
    wm = (WindowManager) ctx.getSystemService(Context.WINDOW_SERVICE);
    int screenW = ctx.getResources().getDisplayMetrics().widthPixels;
    compactW = dp(214);
    compactH = dp(40);
    expandedW = Math.min(screenW - dp(24), dp(360));
    expandedH = dp(180);
    prog = expanded ? 1f : 0f;

    root = new FrameLayout(ctx);
    bg = new GradientDrawable();
    root.setBackground(bg);
    root.setOutlineProvider(new ViewOutlineProvider() {
      @Override
      public void getOutline(View v, Outline o) {
        o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), radiusPx);
      }
    });
    root.setClipToOutline(true);
    root.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        expanded = !expanded;
        animateTo(expanded);
      }
    });

    // ---- pil kecil: sampul | judul di tengah | maskot / equalizer ----
    compact = new LinearLayout(ctx);
    compact.setOrientation(LinearLayout.HORIZONTAL);
    compact.setGravity(Gravity.CENTER_VERTICAL);
    compact.setPadding(dp(5), 0, dp(5), 0);
    compactCover = makeCover(dp(15));
    compact.addView(compactCover, new LinearLayout.LayoutParams(dp(30), dp(30)));
    compactTitle = makeText(13, true, Color.WHITE);
    compactTitle.setGravity(Gravity.CENTER);
    LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    tlp.leftMargin = dp(8);
    tlp.rightMargin = dp(8);
    compact.addView(compactTitle, tlp);
    FrameLayout rightSlot = new FrameLayout(ctx);
    chibiCompact = new IslandViews.ChibiView(ctx);
    eqCompact = new IslandViews.EqView(ctx, Color.WHITE);
    rightSlot.addView(chibiCompact, new FrameLayout.LayoutParams(dp(30), dp(30)));
    rightSlot.addView(eqCompact, new FrameLayout.LayoutParams(dp(30), dp(30)));
    compact.addView(rightSlot, new LinearLayout.LayoutParams(dp(30), dp(30)));
    root.addView(compact, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, compactH));

    // ---- kartu terbuka ----
    expandedBox = new LinearLayout(ctx);
    expandedBox.setOrientation(LinearLayout.VERTICAL);
    expandedBox.setPadding(dp(16), dp(14), dp(16), dp(10));

    LinearLayout head = new LinearLayout(ctx);
    head.setOrientation(LinearLayout.HORIZONTAL);
    head.setGravity(Gravity.CENTER_VERTICAL);
    expandedCover = makeCover(dp(12));
    expandedCover.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        openApp();
      }
    });
    head.addView(expandedCover, new LinearLayout.LayoutParams(dp(54), dp(54)));
    LinearLayout names = new LinearLayout(ctx);
    names.setOrientation(LinearLayout.VERTICAL);
    names.setGravity(Gravity.CENTER_VERTICAL);
    expTitle = makeText(15, true, Color.WHITE);
    expArtist = makeText(12, false, Color.parseColor("#B0FFFFFF"));
    names.addView(expTitle);
    LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    alp.topMargin = dp(3);
    names.addView(expArtist, alp);
    LinearLayout.LayoutParams nlp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    nlp.leftMargin = dp(12);
    nlp.rightMargin = dp(8);
    head.addView(names, nlp);
    FrameLayout rightSlot2 = new FrameLayout(ctx);
    chibiExpanded = new IslandViews.ChibiView(ctx);
    eqExpanded = new IslandViews.EqView(ctx, Color.WHITE);
    rightSlot2.addView(chibiExpanded, new FrameLayout.LayoutParams(dp(34), dp(34)));
    rightSlot2.addView(eqExpanded, new FrameLayout.LayoutParams(dp(34), dp(34)));
    head.addView(rightSlot2, new LinearLayout.LayoutParams(dp(34), dp(34)));
    expandedBox.addView(head, new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

    lyricTv = makeText(13, true, Color.WHITE);
    lyricTv.setGravity(Gravity.CENTER);
    LinearLayout.LayoutParams llp = new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    llp.topMargin = dp(8);
    expandedBox.addView(lyricTv, llp);

    LinearLayout prow = new LinearLayout(ctx);
    prow.setOrientation(LinearLayout.HORIZONTAL);
    prow.setGravity(Gravity.CENTER_VERTICAL);
    elapsedTv = makeText(10, true, Color.parseColor("#B0FFFFFF"));
    remainTv = makeText(10, true, Color.parseColor("#B0FFFFFF"));
    progressView = new IslandViews.ProgressView(ctx, Color.parseColor("#44FFFFFF"), Color.WHITE);
    progressView.setOnSeek(new IslandViews.ProgressView.OnSeek() {
      @Override
      public void onSeek(float f) {
        posSec = f * durSec;
        posStamp = SystemClock.elapsedRealtime();
        dispatch("seek:" + f);
      }
    });
    prow.addView(elapsedTv);
    LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(0, dp(22), 1f);
    plp.leftMargin = dp(8);
    plp.rightMargin = dp(8);
    prow.addView(progressView, plp);
    prow.addView(remainTv);
    LinearLayout.LayoutParams prlp = new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    prlp.topMargin = dp(4);
    expandedBox.addView(prow, prlp);

    LinearLayout controls = new LinearLayout(ctx);
    controls.setOrientation(LinearLayout.HORIZONTAL);
    controls.setGravity(Gravity.CENTER);
    prevIv = new IslandViews.IconView(ctx, IslandViews.PREV, Color.WHITE);
    nextIv = new IslandViews.IconView(ctx, IslandViews.NEXT, Color.WHITE);
    playWrap = new FrameLayout(ctx);
    playBg = new GradientDrawable();
    playBg.setShape(GradientDrawable.OVAL);
    playBg.setColor(Color.WHITE);
    playWrap.setBackground(playBg);
    playIv = new IslandViews.IconView(ctx, IslandViews.PAUSE, Color.BLACK);
    playWrap.addView(playIv, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    prevIv.setOnClickListener(actionClick("prev"));
    nextIv.setOnClickListener(actionClick("next"));
    playWrap.setOnClickListener(actionClick("toggle"));
    controls.addView(prevIv, new LinearLayout.LayoutParams(dp(56), dp(44)));
    LinearLayout.LayoutParams pwlp = new LinearLayout.LayoutParams(dp(46), dp(46));
    pwlp.leftMargin = dp(14);
    pwlp.rightMargin = dp(14);
    controls.addView(playWrap, pwlp);
    controls.addView(nextIv, new LinearLayout.LayoutParams(dp(56), dp(44)));
    expandedBox.addView(controls, new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

    root.addView(expandedBox, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, expandedH));

    int type = Build.VERSION.SDK_INT >= 26
        ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        : WindowManager.LayoutParams.TYPE_PHONE;
    params = new WindowManager.LayoutParams(
        compactW,
        compactH,
        type,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
            | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT);
    params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
    params.y = dp(8);

    applyProgress();
    wm.addView(root, params);

    // muncul dengan gerakan pegas
    root.setAlpha(0f);
    root.setScaleX(0.6f);
    root.setScaleY(0.6f);
    root.setPivotX(compactW / 2f);
    root.setPivotY(0f);
    root.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(420).setInterpolator(SPRING);

    applyCover();
    ui.removeCallbacks(tick);
    ui.post(tick);
  }

  private View.OnClickListener actionClick(final String action) {
    return new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        dispatch(action);
      }
    };
  }

  // ---------------- animasi buka / tutup ----------------

  private void animateTo(boolean expand) {
    if (root == null) return;
    if (anim != null) anim.cancel();
    final float from = prog;
    final float to = expand ? 1f : 0f;
    anim = ValueAnimator.ofFloat(0f, 1f);
    anim.setDuration(expand ? 560 : 420);
    anim.setInterpolator(SPRING);
    anim.addUpdateListener(new ValueAnimator.AnimatorUpdateListener() {
      @Override
      public void onAnimationUpdate(ValueAnimator a) {
        float v = ((Float) a.getAnimatedValue()).floatValue();
        prog = from + (to - from) * v;
        applyProgress();
      }
    });
    anim.start();
  }

  private void applyProgress() {
    if (root == null || params == null) return;
    float p = prog;
    params.width = Math.round(compactW + (expandedW - compactW) * p);
    params.height = Math.round(compactH + (expandedH - compactH) * p);
    float big = dp(30);
    radiusPx = compactH / 2f + (big - compactH / 2f) * clamp01(p);
    float ca = clamp01(1f - p * 2.4f);
    float ea = clamp01((p - 0.35f) / 0.5f);
    compact.setAlpha(ca);
    compact.setVisibility(ca > 0.01f ? View.VISIBLE : View.INVISIBLE);
    expandedBox.setAlpha(ea);
    expandedBox.setVisibility(ea > 0.01f ? View.VISIBLE : View.INVISIBLE);
    root.invalidateOutline();
    try {
      wm.updateViewLayout(root, params);
    } catch (Exception e) {
      // abaikan
    }
  }

  // ---------------- tema & isi ----------------

  private void applyTheme() {
    if (root == null || theme.equals(appliedTheme)) return;
    appliedTheme = theme;
    boolean spidey = "spidey".equals(theme);
    if (spidey) {
      bg.setOrientation(GradientDrawable.Orientation.LEFT_RIGHT);
      bg.setColors(new int[] { 0xFFE62429, 0xFF9B1B4A, 0xFF1F2A8F });
    } else {
      bg.setOrientation(GradientDrawable.Orientation.TOP_BOTTOM);
      bg.setColors(new int[] { 0xFF0B0B0E, 0xFF000000 });
    }
    chibiCompact.setVisibility(spidey ? View.VISIBLE : View.GONE);
    chibiExpanded.setVisibility(spidey ? View.VISIBLE : View.GONE);
    eqCompact.setVisibility(spidey ? View.GONE : View.VISIBLE);
    eqExpanded.setVisibility(spidey ? View.GONE : View.VISIBLE);
    expArtist.setTextColor(Color.parseColor(spidey ? "#E6FFFFFF" : "#9A9AA5"));
    elapsedTv.setTextColor(Color.parseColor(spidey ? "#E6FFFFFF" : "#9A9AA5"));
    remainTv.setTextColor(Color.parseColor(spidey ? "#E6FFFFFF" : "#9A9AA5"));
    progressView.setColors(Color.parseColor(spidey ? "#55FFFFFF" : "#33FFFFFF"), Color.WHITE);
    playBg.setColor(Color.WHITE);
    playIv.setColor(spidey ? 0xFFE62429 : Color.BLACK);
    root.invalidate();
  }

  private void applyState() {
    if (root == null) return;
    compactTitle.setText(title.length() > 0 ? title : "SpideyFy");
    expTitle.setText(title);
    expArtist.setText(artist);
    lyricTv.setText(line.length() > 0 ? line : "\u266A");
    playIv.setType(playing ? IslandViews.PAUSE : IslandViews.PLAY);
    eqCompact.setRunning(playing);
    eqExpanded.setRunning(playing);
    updateProgress();
  }

  private void updateProgress() {
    if (root == null || prog < 0.5f) return;
    double pos = currentPos();
    progressView.setFraction(durSec > 0 ? (float) (pos / durSec) : 0f);
    elapsedTv.setText(fmt(pos));
    remainTv.setText(durSec > 0 ? "-" + fmt(Math.max(0, durSec - pos)) : "--:--");
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
