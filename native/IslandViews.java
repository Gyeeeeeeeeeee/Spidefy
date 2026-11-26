package __PKG__;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.View;

/** View kecil yang digambar sendiri (ikon kontrol, progress, maskot Spidey chibi, equalizer). */
public class IslandViews {
  public static final int PREV = 0;
  public static final int PLAY = 1;
  public static final int PAUSE = 2;
  public static final int NEXT = 3;

  /** Ikon prev / play / pause / next. */
  public static class IconView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rect = new RectF();
    private final Path path = new Path();
    private int type;

    public IconView(Context c, int type, int color) {
      super(c);
      this.type = type;
      paint.setColor(color);
      paint.setStyle(Paint.Style.FILL_AND_STROKE);
      paint.setStrokeJoin(Paint.Join.ROUND);
      paint.setStrokeCap(Paint.Cap.ROUND);
    }

    public void setType(int t) {
      if (t != type) {
        type = t;
        invalidate();
      }
    }

    public void setColor(int color) {
      paint.setColor(color);
      invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
      float s = Math.min(getWidth(), getHeight()) * 0.28f;
      float cx = getWidth() / 2f;
      float cy = getHeight() / 2f;
      paint.setStrokeWidth(s * 0.3f);
      path.reset();
      if (type == PLAY) {
        path.moveTo(cx - s * 0.6f, cy - s);
        path.lineTo(cx + s * 0.95f, cy);
        path.lineTo(cx - s * 0.6f, cy + s);
        path.close();
        canvas.drawPath(path, paint);
      } else if (type == PAUSE) {
        rect.set(cx - s * 0.8f, cy - s, cx - s * 0.2f, cy + s);
        canvas.drawRoundRect(rect, s * 0.2f, s * 0.2f, paint);
        rect.set(cx + s * 0.2f, cy - s, cx + s * 0.8f, cy + s);
        canvas.drawRoundRect(rect, s * 0.2f, s * 0.2f, paint);
      } else if (type == NEXT) {
        path.moveTo(cx - s, cy - s * 0.8f);
        path.lineTo(cx + s * 0.5f, cy);
        path.lineTo(cx - s, cy + s * 0.8f);
        path.close();
        canvas.drawPath(path, paint);
        rect.set(cx + s * 0.6f, cy - s * 0.8f, cx + s * 0.95f, cy + s * 0.8f);
        canvas.drawRoundRect(rect, s * 0.15f, s * 0.15f, paint);
      } else {
        path.moveTo(cx + s, cy - s * 0.8f);
        path.lineTo(cx - s * 0.5f, cy);
        path.lineTo(cx + s, cy + s * 0.8f);
        path.close();
        canvas.drawPath(path, paint);
        rect.set(cx - s * 0.95f, cy - s * 0.8f, cx - s * 0.6f, cy + s * 0.8f);
        canvas.drawRoundRect(rect, s * 0.15f, s * 0.15f, paint);
      }
    }
  }

  /** Bar progress yang bisa diketuk / digeser untuk seek. */
  public static class ProgressView extends View {
    public interface OnSeek {
      void onSeek(float fraction);
    }

    private final Paint trackPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rect = new RectF();
    private float fraction = 0f;
    private boolean dragging = false;
    private OnSeek onSeek;

    public ProgressView(Context c, int trackColor, int fillColor) {
      super(c);
      trackPaint.setColor(trackColor);
      fillPaint.setColor(fillColor);
    }

    public void setColors(int trackColor, int fillColor) {
      trackPaint.setColor(trackColor);
      fillPaint.setColor(fillColor);
      invalidate();
    }

    public void setOnSeek(OnSeek s) {
      onSeek = s;
    }

    public void setFraction(float f) {
      if (dragging) return;
      fraction = Math.max(0f, Math.min(1f, f));
      invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
      float w = getWidth();
      float h = Math.max(4f, getHeight() * 0.22f);
      float top = (getHeight() - h) / 2f;
      rect.set(0, top, w, top + h);
      canvas.drawRoundRect(rect, h / 2f, h / 2f, trackPaint);
      rect.set(0, top, Math.max(h, w * fraction), top + h);
      canvas.drawRoundRect(rect, h / 2f, h / 2f, fillPaint);
      if (dragging) {
        canvas.drawCircle(w * fraction, getHeight() / 2f, h * 1.4f, fillPaint);
      }
    }

    private float fracOf(MotionEvent e) {
      float w = Math.max(1f, getWidth());
      return Math.max(0f, Math.min(1f, e.getX() / w));
    }

    @Override
    public boolean onTouchEvent(MotionEvent e) {
      switch (e.getAction()) {
        case MotionEvent.ACTION_DOWN:
          dragging = true;
          if (getParent() != null) getParent().requestDisallowInterceptTouchEvent(true);
          fraction = fracOf(e);
          invalidate();
          return true;
        case MotionEvent.ACTION_MOVE:
          fraction = fracOf(e);
          invalidate();
          return true;
        case MotionEvent.ACTION_UP:
          fraction = fracOf(e);
          dragging = false;
          invalidate();
          if (onSeek != null) onSeek.onSeek(fraction);
          return true;
        case MotionEvent.ACTION_CANCEL:
          dragging = false;
          invalidate();
          return true;
        default:
          return true;
      }
    }
  }

  /** Maskot Spidey chibi (kepala merah, mata besar). */
  public static class ChibiView extends View {
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rect = new RectF();

    public ChibiView(Context c) {
      super(c);
      line.setStyle(Paint.Style.STROKE);
      line.setStrokeCap(Paint.Cap.ROUND);
    }

    @Override
    protected void onDraw(Canvas canvas) {
      float sc = Math.min(getWidth(), getHeight()) / 100f;
      canvas.save();
      canvas.translate((getWidth() - 100f * sc) / 2f, (getHeight() - 100f * sc) / 2f);
      canvas.scale(sc, sc);

      // kepala
      fill.setStyle(Paint.Style.FILL);
      fill.setColor(0xFFE62429);
      canvas.drawCircle(50f, 52f, 44f, fill);
      line.setColor(0xFF111118);
      line.setStrokeWidth(4f);
      canvas.drawCircle(50f, 52f, 44f, line);

      // jaring di dahi
      line.setColor(0x99111118);
      line.setStrokeWidth(2.4f);
      canvas.drawLine(50f, 9f, 50f, 34f, line);
      canvas.drawLine(26f, 17f, 39f, 36f, line);
      canvas.drawLine(74f, 17f, 61f, 36f, line);
      rect.set(30f, 2f, 70f, 40f);
      canvas.drawArc(rect, 200f, 140f, false, line);

      // mata besar (miring)
      fill.setColor(0xFFFFFFFF);
      line.setColor(0xFF111118);
      line.setStrokeWidth(4f);
      canvas.save();
      canvas.rotate(-14f, 33f, 58f);
      rect.set(15f, 44f, 49f, 72f);
      canvas.drawOval(rect, fill);
      canvas.drawOval(rect, line);
      canvas.restore();
      canvas.save();
      canvas.rotate(14f, 67f, 58f);
      rect.set(51f, 44f, 85f, 72f);
      canvas.drawOval(rect, fill);
      canvas.drawOval(rect, line);
      canvas.restore();

      // pipi merah muda + senyum kecil
      fill.setColor(0x66FF8FA3);
      rect.set(16f, 72f, 28f, 80f);
      canvas.drawOval(rect, fill);
      rect.set(72f, 72f, 84f, 80f);
      canvas.drawOval(rect, fill);
      line.setColor(0xFF111118);
      line.setStrokeWidth(3f);
      rect.set(42f, 74f, 58f, 86f);
      canvas.drawArc(rect, 20f, 140f, false, line);

      canvas.restore();
    }
  }

  /** Equalizer mini (3 batang) yang bergoyang saat musik diputar. */
  public static class EqView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF rect = new RectF();
    private boolean running = false;

    public EqView(Context c, int color) {
      super(c);
      paint.setColor(color);
    }

    public void setColor(int color) {
      paint.setColor(color);
      invalidate();
    }

    public void setRunning(boolean r) {
      running = r;
      invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
      float w = getWidth();
      float h = getHeight();
      float bar = w * 0.16f;
      float gap = w * 0.12f;
      float total = bar * 3f + gap * 2f;
      float x = (w - total) / 2f;
      float t = SystemClock.uptimeMillis() / 1000f;
      for (int i = 0; i < 3; i++) {
        float f = running ? 0.3f + 0.7f * (float) Math.abs(Math.sin(t * 3.2f + i * 1.7f)) : 0.3f;
        float bh = h * 0.7f * f;
        rect.set(x, (h + h * 0.7f) / 2f - bh, x + bar, (h + h * 0.7f) / 2f);
        canvas.drawRoundRect(rect, bar / 2f, bar / 2f, paint);
        x += bar + gap;
      }
      if (running) postInvalidateOnAnimation();
    }
  }
}
