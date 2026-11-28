package __PKG__;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.text.TextPaint;
import android.util.TypedValue;
import android.view.View;

import java.util.ArrayList;

/**
 * Gaya lirik "Webtype": kata-kata besar & tebal bertumpuk ke bawah, muncul satu per satu mengikuti
 * nyanyian, lalu baris lama naik dan memudar saat baris baru masuk.
 * Semua digambar sendiri per frame dan posisinya dihitung dari waktu lagu (native), jadi tetap mulus
 * dan tidak ikut tersendat walau JavaScript app ditahan sistem.
 */
public class KineticLyricsView extends View {
  private static final float ENTER_SEC = 0.34f; // lama satu kata "mendarat"
  private static final float EXIT_SEC = 0.48f; // lama baris lama naik & hilang

  private static class Lay {
    String key = "";
    String[] words = new String[0];
    float[] x = new float[0];
    float[] wd = new float[0];
    float[] frac = new float[0]; // 0..1 posisi kata di dalam durasi baris
    int[] row = new int[0];
    float[] baseY = new float[0];
    int rows = 0;
    float size = 0f;
  }

  private final IslandOverlay st;
  private final TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
  private Lay cur;
  private Lay prev;
  private int accent = Color.WHITE;
  private boolean running = false;
  private String fbText = "";
  private long fbStart = 0L;
  private double lastPos = -1;

  private final Runnable frame = new Runnable() {
    @Override
    public void run() {
      if (!running || !isAttachedToWindow()) {
        running = false;
        return;
      }
      invalidate();
      postOnAnimation(this);
    }
  };

  public KineticLyricsView(Context c, IslandOverlay st) {
    super(c);
    this.st = st;
    Typeface tf;
    try {
      tf = Typeface.create("sans-serif-black", Typeface.NORMAL);
    } catch (Exception e) {
      tf = Typeface.DEFAULT_BOLD;
    }
    if (tf == null) tf = Typeface.DEFAULT_BOLD;
    paint.setTypeface(tf);
    paint.setColor(Color.WHITE);
    paint.setLetterSpacing(-0.02f);
  }

  private float sp(float v) {
    return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, v, getResources().getDisplayMetrics());
  }

  public void setAccent(int color) {
    accent = color;
  }

  /** Mulai / lanjutkan animasi. */
  public void kick() {
    removeCallbacks(frame);
    running = true;
    postOnAnimation(frame);
    invalidate();
  }

  /** Hentikan animasi (layar tidak tampil). */
  public void pause() {
    running = false;
    removeCallbacks(frame);
  }

  @Override
  protected void onDetachedFromWindow() {
    pause();
    super.onDetachedFromWindow();
  }

  @Override
  protected void onSizeChanged(int w, int h, int ow, int oh) {
    super.onSizeChanged(w, h, ow, oh);
    cur = null;
    prev = null;
  }

  // ---------------------------------------------------------------- layout

  private Lay build(String key, String text, int W, int H) {
    Lay L = new Lay();
    L.key = key;
    String t = text == null ? "" : text.trim();
    if (t.length() == 0) return L;
    String[] ws = t.split("\\s+");
    int n = ws.length;
    float maxW = W * 0.92f;
    float maxH = H * 0.94f;

    int[] rowOf = new int[n];
    float[] wd = new float[n];
    int rows = 1;
    float size = sp(76f);

    for (int attempt = 0; attempt < 2; attempt++) {
      boolean pair = attempt == 1;
      int r = 0;
      int cnt = 0;
      for (int i = 0; i < n; i++) {
        if (i == 0) {
          rowOf[0] = 0;
          cnt = 1;
          continue;
        }
        boolean merge;
        if (pair) merge = cnt < 2;
        else merge = cnt < 2 && ws[i - 1].length() <= 3 && ws[i].length() <= 3;
        if (merge) {
          rowOf[i] = r;
          cnt++;
        } else {
          r++;
          rowOf[i] = r;
          cnt = 1;
        }
      }
      rows = r + 1;

      size = sp(76f);
      float minSize = sp(30f);
      while (true) {
        paint.setTextSize(size);
        float space = size * 0.24f;
        float widest = 0f;
        float[] rowW = new float[rows];
        int[] rowCnt = new int[rows];
        for (int i = 0; i < n; i++) {
          wd[i] = paint.measureText(ws[i]);
          rowW[rowOf[i]] += wd[i];
          rowCnt[rowOf[i]]++;
        }
        for (int k = 0; k < rows; k++) {
          rowW[k] += Math.max(0, rowCnt[k] - 1) * space;
          if (rowW[k] > widest) widest = rowW[k];
        }
        float rowH = size * 1.04f;
        if (widest <= maxW && rows * rowH <= maxH) break;
        if (size <= minSize) break;
        size = Math.max(minSize, size * 0.93f);
      }
      if (rows * size * 1.04f <= maxH) break;
    }

    paint.setTextSize(size);
    float space = size * 0.24f;
    float rowH = size * 1.04f;
    Paint.FontMetrics fm = paint.getFontMetrics();
    float top = (H - rows * rowH) / 2f;

    L.words = ws;
    L.size = size;
    L.rows = rows;
    L.row = rowOf;
    L.wd = new float[n];
    L.x = new float[n];
    L.frac = new float[n];
    L.baseY = new float[rows];

    for (int k = 0; k < rows; k++) {
      L.baseY[k] = top + k * rowH + (rowH - (fm.descent - fm.ascent)) / 2f - fm.ascent;
    }
    // x tiap kata (tiap baris rata tengah)
    int i = 0;
    while (i < n) {
      int j = i;
      float total = 0f;
      while (j < n && rowOf[j] == rowOf[i]) {
        L.wd[j] = paint.measureText(ws[j]);
        total += L.wd[j];
        j++;
      }
      total += (j - i - 1) * space;
      float x = (W - total) / 2f;
      for (int q = i; q < j; q++) {
        L.x[q] = x;
        x += L.wd[q] + space;
      }
      i = j;
    }
    // waktu muncul tiap kata: berat = panjang kata
    float totalW = 0f;
    for (int q = 0; q < n; q++) totalW += ws[q].length() + 2f;
    float acc = 0f;
    for (int q = 0; q < n; q++) {
      L.frac[q] = acc / totalW;
      acc += ws[q].length() + 2f;
    }
    return L;
  }

  // ------------------------------------------------------------------ draw

  private static float easeOut(float p) {
    float q = 1f - Math.max(0f, Math.min(1f, p));
    return 1f - q * q * q;
  }

  private void drawLay(Canvas c, Lay L, float lineT, float span, float alphaMul, float dy, float scaleMul,
      boolean allRevealed) {
    if (L == null || L.words.length == 0) return;
    for (int i = 0; i < L.words.length; i++) {
      float e = allRevealed ? 99f : lineT - L.frac[i] * span;
      if (e < 0f) continue;
      float k = easeOut(e / ENTER_SEC);
      float a = k * alphaMul;
      if (a <= 0.01f) continue;
      float by = L.baseY[L.row[i]];
      float cx = L.x[i] + L.wd[i] / 2f;
      float s = (0.84f + 0.16f * k) * scaleMul;

      float glow = allRevealed ? 0f : L.size * 0.2f * Math.max(0f, 1f - e / 0.9f);
      if (glow > 0.5f) paint.setShadowLayer(glow, 0f, 0f, accent);
      else paint.clearShadowLayer();

      c.save();
      c.translate(0f, dy + (1f - k) * L.size * 0.32f);
      c.scale(s, s, cx, by - L.size * 0.35f);
      paint.setAlpha(Math.round(255f * Math.min(1f, a)));
      paint.setTextSize(L.size);
      c.drawText(L.words[i], L.x[i], by, paint);
      c.restore();
    }
    paint.clearShadowLayer();
    paint.setAlpha(255);
  }

  @Override
  protected void onDraw(Canvas c) {
    int W = getWidth();
    int H = getHeight();
    if (W <= 0 || H <= 0) return;

    double[] ts = st.lockTimes();
    String[] tx = st.lockTexts();
    double pos = st.lyricPos();
    boolean synced = ts != null && tx != null && ts.length > 0 && ts.length == tx.length;

    String key;
    String text;
    float lineT;
    float lineDur;
    if (synced) {
      int idx = -1;
      for (int i = 0; i < ts.length; i++) {
        if (pos >= ts[i]) idx = i;
        else break;
      }
      key = "s" + idx + "@" + System.identityHashCode(tx);
      if (idx < 0) {
        text = "";
        lineT = 0f;
        lineDur = 0f;
      } else {
        text = tx[idx] == null ? "" : tx[idx];
        lineT = (float) (pos - ts[idx]);
        lineDur = idx + 1 < ts.length ? (float) (ts[idx + 1] - ts[idx]) : 5f;
      }
    } else {
      String fb = (st.lines[2] == null) ? "" : st.lines[2].trim();
      if (!fb.equals(fbText)) {
        fbText = fb;
        fbStart = SystemClock.uptimeMillis();
      }
      key = "f:" + fb;
      text = fb;
      lineT = (SystemClock.uptimeMillis() - fbStart) / 1000f;
      lineDur = 4f;
    }
    if (lineT < 0f) lineT = 0f;

    if (cur == null || !cur.key.equals(key)) {
      prev = cur;
      cur = build(key, text, W, H);
    }

    int n = cur.words.length;
    float span;
    if (synced) span = Math.min(Math.max(lineDur * 0.68f, 0.45f), Math.min(4.2f, 0.55f * Math.max(1, n)));
    else span = 0.09f * Math.max(1, n);

    float fade = 1f;
    if (synced && lineDur > 6f && lineT > 5f) fade = 1f - Math.min(1f, (lineT - 5f) / 0.6f);

    // baris lama naik & memudar
    if (prev != null) {
      if (lineT < EXIT_SEC && prev.words.length > 0) {
        float tp = lineT / EXIT_SEC;
        float e = easeOut(tp);
        float al = (1f - tp) * (1f - tp);
        drawLay(c, prev, 0f, 1f, al * 0.85f, -e * H * 0.16f, 1f - 0.05f * e, true);
      } else if (lineT >= EXIT_SEC) {
        prev = null;
      }
    }

    if (n == 0) {
      // jeda / intro / tanpa lirik: tampilkan nada yang bernapas pelan
      double breathe = 0.5 + 0.5 * Math.sin(SystemClock.uptimeMillis() / 520.0);
      paint.setTextSize(sp(40f));
      paint.setAlpha((int) (70 + 80 * breathe));
      String note = "\u266A";
      float w = paint.measureText(note);
      c.drawText(note, (W - w) / 2f, H / 2f + sp(14f), paint);
      paint.setAlpha(255);
    } else {
      drawLay(c, cur, lineT, span, fade, 0f, 1f, false);
    }

    // berhenti menggambar kalau lagu dijeda dan semuanya sudah tenang
    if (!st.playing && lineT > 2.0f && Math.abs(pos - lastPos) < 1e-4) running = false;
    lastPos = pos;
  }
}
