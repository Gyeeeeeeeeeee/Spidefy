package __PKG__;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.Window;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextClock;
import android.widget.TextView;

/** Layar lirik yang tampil di atas layar kunci saat layar menyala dan musik sedang diputar. */
public class LockLyricsActivity extends Activity implements IslandOverlay.StateObserver {
  private final Handler ui = new Handler(Looper.getMainLooper());
  private IslandOverlay st;
  private FrameLayout root;
  private GradientDrawable bg;
  private final TextView[] lyricTvs = new TextView[5];
  private LinearLayout lyricBox;
  private KineticLyricsView kinetic;
  private String appliedStyle = "";
  private String[] prevLines = null;
  private ImageView coverIv;
  private TextView titleTv;
  private TextView artistTv;
  private TextView elapsedTv;
  private TextView remainTv;
  private TextView hintTv;
  private TextView dateTv;
  private TextClock timeTv;
  private IslandViews.ProgressView progress;
  private IslandViews.IconView prevIv;
  private IslandViews.IconView playIv;
  private IslandViews.IconView nextIv;
  private GradientDrawable cardBg;
  private GradientDrawable playBg;
  private BroadcastReceiver unlockReceiver;
  private float downY = 0f;
  private String appliedTheme = "";

  private final Runnable tick = new Runnable() {
    @Override
    public void run() {
      updateProgress();
      ui.postDelayed(this, 400);
    }
  };

  private int dp(int v) {
    return Math.round(v * getResources().getDisplayMetrics().density);
  }

  @Override
  protected void onCreate(Bundle b) {
    super.onCreate(b);
    st = IslandOverlay.get(this);

    if (Build.VERSION.SDK_INT >= 27) {
      setShowWhenLocked(true);
    } else {
      getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED);
    }
    Window w = getWindow();
    w.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
    w.setStatusBarColor(Color.TRANSPARENT);
    w.setNavigationBarColor(Color.TRANSPARENT);
    w.getDecorView().setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

    buildUi();

    unlockReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context c, Intent i) {
        finish();
      }
    };
    try {
      IntentFilter f = new IntentFilter(Intent.ACTION_USER_PRESENT);
      if (Build.VERSION.SDK_INT >= 33) {
        registerReceiver(unlockReceiver, f, Context.RECEIVER_EXPORTED);
      } else {
        registerReceiver(unlockReceiver, f);
      }
    } catch (Exception e) {
      unlockReceiver = null;
    }
  }

  private TextView text(int sp, boolean bold, int color) {
    TextView t = new TextView(this);
    t.setTextSize(sp);
    t.setTextColor(color);
    t.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
    t.setIncludeFontPadding(false);
    return t;
  }

  private void buildUi() {
    root = new FrameLayout(this);
    bg = new GradientDrawable();
    bg.setOrientation(GradientDrawable.Orientation.TOP_BOTTOM);
    root.setBackground(bg);

    LinearLayout col = new LinearLayout(this);
    col.setOrientation(LinearLayout.VERTICAL);
    col.setPadding(dp(26), dp(64), dp(26), dp(30));

    // tanggal + jam
    TextClock date = new TextClock(this);
    date.setFormat24Hour("EEEE d MMMM");
    date.setFormat12Hour("EEEE d MMMM");
    date.setTextSize(15);
    date.setTextColor(Color.parseColor("#B8FFFFFF"));
    date.setTypeface(Typeface.DEFAULT_BOLD);
    date.setGravity(Gravity.CENTER);
    col.addView(date, new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
    timeTv = new TextClock(this);
    timeTv.setFormat24Hour("HH.mm");
    timeTv.setFormat12Hour("hh.mm");
    timeTv.setTextSize(76);
    timeTv.setTextColor(Color.WHITE);
    timeTv.setTypeface(Typeface.DEFAULT_BOLD);
    timeTv.setGravity(Gravity.CENTER);
    timeTv.setIncludeFontPadding(false);
    col.addView(timeTv, new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

    // lirik (5 baris, yang tengah menyala)
    lyricBox = new LinearLayout(this);
    lyricBox.setOrientation(LinearLayout.VERTICAL);
    lyricBox.setGravity(Gravity.CENTER_VERTICAL);
    for (int i = 0; i < 5; i++) {
      TextView t = text(i == 2 ? 27 : 22, true, Color.WHITE);
      t.setMaxLines(3);
      t.setEllipsize(TextUtils.TruncateAt.END);
      t.setLineSpacing(0f, 1.05f);
      LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
      lp.topMargin = dp(i == 0 ? 0 : 12);
      lyricBox.addView(t, lp);
      lyricTvs[i] = t;
    }
    // wadah lirik: gaya klasik (5 baris) atau gaya Webtype (kinetik), salah satu yang tampil
    FrameLayout lyricHost = new FrameLayout(this);
    lyricHost.addView(lyricBox, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    kinetic = new KineticLyricsView(this, st);
    kinetic.setVisibility(View.GONE);
    lyricHost.addView(kinetic, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    col.addView(lyricHost, new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

    // kartu media
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(16), dp(14), dp(16), dp(10));
    cardBg = new GradientDrawable();
    cardBg.setCornerRadius(dp(28));
    cardBg.setColor(Color.parseColor("#26FFFFFF"));
    card.setBackground(cardBg);

    LinearLayout head = new LinearLayout(this);
    head.setOrientation(LinearLayout.HORIZONTAL);
    head.setGravity(Gravity.CENTER_VERTICAL);
    coverIv = new ImageView(this);
    coverIv.setScaleType(ImageView.ScaleType.CENTER_CROP);
    coverIv.setBackgroundColor(Color.parseColor("#33FFFFFF"));
    coverIv.setOutlineProvider(new ViewOutlineProvider() {
      @Override
      public void getOutline(View v, Outline o) {
        o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), dp(12));
      }
    });
    coverIv.setClipToOutline(true);
    head.addView(coverIv, new LinearLayout.LayoutParams(dp(52), dp(52)));
    LinearLayout names = new LinearLayout(this);
    names.setOrientation(LinearLayout.VERTICAL);
    titleTv = text(15, true, Color.WHITE);
    titleTv.setSingleLine(true);
    titleTv.setEllipsize(TextUtils.TruncateAt.END);
    artistTv = text(12, false, Color.parseColor("#B8FFFFFF"));
    artistTv.setSingleLine(true);
    artistTv.setEllipsize(TextUtils.TruncateAt.END);
    names.addView(titleTv);
    LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    alp.topMargin = dp(3);
    names.addView(artistTv, alp);
    LinearLayout.LayoutParams nlp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    nlp.leftMargin = dp(12);
    head.addView(names, nlp);
    card.addView(head, new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

    LinearLayout prow = new LinearLayout(this);
    prow.setOrientation(LinearLayout.HORIZONTAL);
    prow.setGravity(Gravity.CENTER_VERTICAL);
    elapsedTv = text(10, true, Color.parseColor("#B8FFFFFF"));
    remainTv = text(10, true, Color.parseColor("#B8FFFFFF"));
    progress = new IslandViews.ProgressView(this, Color.parseColor("#44FFFFFF"), Color.WHITE);
    progress.setOnSeek(new IslandViews.ProgressView.OnSeek() {
      @Override
      public void onSeek(float f) {
        st.posSec = f * st.durSec;
        st.posStamp = android.os.SystemClock.elapsedRealtime();
        st.dispatch("seek:" + f);
      }
    });
    prow.addView(elapsedTv);
    LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(0, dp(24), 1f);
    plp.leftMargin = dp(8);
    plp.rightMargin = dp(8);
    prow.addView(progress, plp);
    prow.addView(remainTv);
    LinearLayout.LayoutParams prlp = new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    prlp.topMargin = dp(6);
    card.addView(prow, prlp);

    LinearLayout controls = new LinearLayout(this);
    controls.setGravity(Gravity.CENTER);
    prevIv = new IslandViews.IconView(this, IslandViews.PREV, Color.WHITE);
    nextIv = new IslandViews.IconView(this, IslandViews.NEXT, Color.WHITE);
    playIv = new IslandViews.IconView(this, IslandViews.PAUSE, Color.BLACK);
    FrameLayout playWrap = new FrameLayout(this);
    playBg = new GradientDrawable();
    playBg.setShape(GradientDrawable.OVAL);
    playBg.setColor(Color.WHITE);
    playWrap.setBackground(playBg);
    playWrap.addView(playIv, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    prevIv.setOnClickListener(action("prev"));
    nextIv.setOnClickListener(action("next"));
    playWrap.setOnClickListener(action("toggle"));
    controls.addView(prevIv, new LinearLayout.LayoutParams(dp(60), dp(46)));
    LinearLayout.LayoutParams pwlp = new LinearLayout.LayoutParams(dp(50), dp(50));
    pwlp.leftMargin = dp(16);
    pwlp.rightMargin = dp(16);
    controls.addView(playWrap, pwlp);
    controls.addView(nextIv, new LinearLayout.LayoutParams(dp(60), dp(46)));
    card.addView(controls, new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

    col.addView(card, new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

    hintTv = text(11, true, Color.parseColor("#80FFFFFF"));
    hintTv.setText("Geser ke atas untuk membuka");
    hintTv.setGravity(Gravity.CENTER);
    LinearLayout.LayoutParams hlp = new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    hlp.topMargin = dp(14);
    col.addView(hintTv, hlp);

    root.addView(col, new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

    // geser ke atas = buka kunci
    root.setOnTouchListener(new View.OnTouchListener() {
      @Override
      public boolean onTouch(View v, MotionEvent e) {
        if (e.getAction() == MotionEvent.ACTION_DOWN) {
          downY = e.getY();
        } else if (e.getAction() == MotionEvent.ACTION_UP) {
          if (downY - e.getY() > dp(110)) {
            dismissLock();
          }
        }
        return true;
      }
    });
    setContentView(root);
  }

  private View.OnClickListener action(final String a) {
    return new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        st.dispatch(a);
      }
    };
  }

  private void dismissLock() {
    try {
      if (Build.VERSION.SDK_INT >= 26) {
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (km != null) {
          km.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
            @Override
            public void onDismissSucceeded() {
              finish();
            }
          });
          return;
        }
      }
    } catch (Exception e) {
      // lanjut finish biasa
    }
    finish();
  }

  @Override
  protected void onStart() {
    super.onStart();
    st.addObserver(this);
    refresh();
    ui.removeCallbacks(tick);
    ui.post(tick);
    if (kinetic != null && kinetic.getVisibility() == View.VISIBLE) kinetic.kick();
  }

  @Override
  protected void onStop() {
    super.onStop();
    st.removeObserver(this);
    ui.removeCallbacks(tick);
    if (kinetic != null) kinetic.pause();
  }

  @Override
  protected void onDestroy() {
    if (unlockReceiver != null) {
      try {
        unregisterReceiver(unlockReceiver);
      } catch (Exception e) {
        // abaikan
      }
    }
    super.onDestroy();
  }

  @Override
  public void onBackPressed() {
    finish();
  }

  @Override
  public void onState() {
    refresh();
  }

  private void applyTheme() {
    if (st.theme.equals(appliedTheme)) return;
    appliedTheme = st.theme;
    boolean spidey = "spidey".equals(st.theme);
    if ("webtype".equals(st.lockStyle)) {
      bg.setColors(new int[] { 0xFF000000, 0xFF000000, 0xFF000000 }); // hitam pekat (hemat di OLED)
    } else if (spidey) {
      bg.setColors(new int[] { 0xFF4A0B14, 0xFF140A2E, 0xFF05060F });
    } else {
      bg.setColors(new int[] { 0xFF15151B, 0xFF08080B, 0xFF000000 });
    }
    playIv.setColor(spidey ? 0xFFE62429 : Color.BLACK);
    if (kinetic != null) kinetic.setAccent(spidey ? 0xFFE62429 : Color.WHITE);
  }

  /** Ganti antara gaya Klasik dan Webtype. */
  private void applyStyle() {
    String want = "webtype".equals(st.lockStyle) ? "webtype" : "classic";
    if (want.equals(appliedStyle)) return;
    appliedStyle = want;
    appliedTheme = ""; // paksa warna latar dihitung ulang
    boolean web = "webtype".equals(want);
    lyricBox.setVisibility(web ? View.GONE : View.VISIBLE);
    kinetic.setVisibility(web ? View.VISIBLE : View.GONE);
    timeTv.setTextSize(web ? 40 : 76); // jam dikecilkan supaya lirik dapat ruang
    if (web) kinetic.kick();
    else kinetic.pause();
    prevLines = null;
  }

  private void refresh() {
    applyStyle();
    applyTheme();
    titleTv.setText(st.title);
    artistTv.setText(st.artist);
    if (st.cover != null) coverIv.setImageBitmap(st.cover);
    else coverIv.setImageDrawable(null);
    playIv.setType(st.playing ? IslandViews.PAUSE : IslandViews.PLAY);

    if ("webtype".equals(appliedStyle)) kinetic.kick();
    else applyLyrics();
    updateProgress();
  }

  private static float lineAlpha(int i) {
    int dist = Math.abs(i - 2);
    return dist == 0 ? 1f : (dist == 1 ? 0.5f : 0.22f);
  }

  /** Lirik bergeser halus ke atas seperti di aplikasi musik; baris baru memudar masuk. */
  private void applyLyrics() {
    final String[] cur = new String[5];
    boolean any = false;
    for (int i = 0; i < 5; i++) {
      cur[i] = st.lines[i] == null ? "" : st.lines[i];
      if (cur[i].length() > 0) any = true;
    }
    if (prevLines != null && java.util.Arrays.equals(prevLines, cur)) return; // tidak berubah
    final String[] old = prevLines;
    prevLines = cur;

    // baris berikutnya naik jadi baris aktif?
    boolean advance = old != null && cur[2].length() > 0 && cur[2].equals(old[3]);
    int shift = 0;
    if (advance) {
      int h2 = lyricTvs[2].getHeight();
      int h3 = lyricTvs[3].getHeight();
      shift = (h2 + h3) / 2 + dp(12);
    }

    lyricBox.animate().cancel();
    for (int i = 0; i < 5; i++) {
      lyricTvs[i].animate().cancel();
      lyricTvs[i].setText(cur[i]);
      lyricTvs[i].setVisibility(cur[i].length() > 0 ? View.VISIBLE : View.GONE);
    }
    if (!any) {
      lyricTvs[2].setText("\u266A");
      lyricTvs[2].setVisibility(View.VISIBLE);
    }
    float[] target = new float[5];
    for (int i = 0; i < 5; i++) target[i] = (!any && i == 2) ? 0.6f : lineAlpha(i);

    if (old == null) {
      for (int i = 0; i < 5; i++) lyricTvs[i].setAlpha(target[i]);
      lyricBox.setTranslationY(0f);
      return;
    }

    if (advance) {
      // alpha awal = alpha posisi lama dari baris yang sama (baris paling bawah baru: 0)
      for (int i = 0; i < 5; i++) {
        float from = i == 4 ? 0f : lineAlpha(i + 1);
        lyricTvs[i].setAlpha(from);
        lyricTvs[i].animate().alpha(target[i]).setDuration(420)
            .setInterpolator(new DecelerateInterpolator()).start();
      }
      lyricBox.setTranslationY(shift);
      lyricBox.animate().translationY(0f).setDuration(480)
          .setInterpolator(new DecelerateInterpolator(1.6f)).start();
    } else {
      // lompat (geser lagu / ganti lagu): fade halus
      lyricBox.setTranslationY(0f);
      for (int i = 0; i < 5; i++) {
        lyricTvs[i].setAlpha(0f);
        lyricTvs[i].animate().alpha(target[i]).setDuration(320).start();
      }
    }
  }

  private void updateProgress() {
    double pos = st.currentPos();
    progress.setFraction(st.durSec > 0 ? (float) (pos / st.durSec) : 0f);
    elapsedTv.setText(IslandOverlay.fmt(pos));
    remainTv.setText(st.durSec > 0 ? "-" + IslandOverlay.fmt(Math.max(0, st.durSec - pos)) : "--:--");
  }
}
