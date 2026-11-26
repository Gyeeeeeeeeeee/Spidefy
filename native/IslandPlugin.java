package __PKG__;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Island")
public class IslandPlugin extends Plugin {

  @Override
  public void load() {
    IslandOverlay.get(getContext()).setListener(new IslandOverlay.Listener() {
      @Override
      public void onAction(String action) {
        JSObject o = new JSObject();
        o.put("action", action);
        notifyListeners("action", o);
      }
    });
  }

  @PluginMethod
  public void hasPermission(PluginCall call) {
    JSObject r = new JSObject();
    r.put("granted", Settings.canDrawOverlays(getContext()));
    call.resolve(r);
  }

  @PluginMethod
  public void requestPermission(PluginCall call) {
    try {
      Intent i = new Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:" + getContext().getPackageName()));
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(i);
    } catch (Exception e) {
      // abaikan
    }
    call.resolve();
  }

  @PluginMethod
  public void setEnabled(PluginCall call) {
    Boolean enabled = call.getBoolean("enabled", false);
    IslandOverlay.get(getContext()).setEnabled(enabled != null && enabled);
    call.resolve();
  }

  @PluginMethod
  public void setTheme(PluginCall call) {
    IslandOverlay.get(getContext()).setTheme(call.getString("theme", "spidey"));
    call.resolve();
  }

  @PluginMethod
  public void setLockLyrics(PluginCall call) {
    Boolean enabled = call.getBoolean("enabled", false);
    IslandOverlay.get(getContext()).setLockLyrics(enabled != null && enabled);
    call.resolve();
  }

  @PluginMethod
  public void update(PluginCall call) {
    Boolean playing = call.getBoolean("playing", false);
    Boolean active = call.getBoolean("active", false);
    Double pos = call.getDouble("position", 0.0);
    Double dur = call.getDouble("duration", 0.0);

    String[] lines = new String[] { "", "", "", "", "" };
    JSArray arr = call.getArray("lines");
    if (arr != null) {
      for (int i = 0; i < 5 && i < arr.length(); i++) {
        lines[i] = arr.optString(i, "");
      }
    }

    IslandOverlay.get(getContext()).update(
        call.getString("title", ""),
        call.getString("artist", ""),
        call.getString("cover", ""),
        call.getString("line", ""),
        lines,
        playing != null && playing,
        active != null && active,
        pos == null ? 0.0 : pos.doubleValue(),
        dur == null ? 0.0 : dur.doubleValue());
    call.resolve();
  }
}
