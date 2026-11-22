package it.doctorcar.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Il widget della Home di Android: la prossima scadenza e tre tasti che aprono direttamente il modulo giusto. */
public class DoctorCarWidget extends AppWidgetProvider {
    private static PendingIntent apri(Context c, String cosa) {
        Intent i = new Intent(c, MainActivity.class);
        i.setAction(Intent.ACTION_MAIN);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra("scorciatoia", cosa);
        return PendingIntent.getActivity(c, 100 + cosa.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static RemoteViews vista(Context c, int layout) {
        RemoteViews v = new RemoteViews(c.getPackageName(), layout);
        android.content.SharedPreferences p = c.getSharedPreferences("doctorcar_widget", Context.MODE_PRIVATE);
        v.setTextViewText(R.id.w_riga1, p.getString("riga1", "DoctorCar"));
        v.setTextViewText(R.id.w_riga2, p.getString("riga2", Testi.t("Tocca per aprire", "Tap to open")));
        if (layout == R.layout.widget_doctorcar) riempiRighe(c, v, p);
        v.setOnClickPendingIntent(R.id.w_testi, apri(c, ""));
        v.setOnClickPendingIntent(R.id.w_rifornimento, apri(c, "rifornimento"));
        v.setOnClickPendingIntent(R.id.w_km, apri(c, "km"));
        v.setOnClickPendingIntent(R.id.w_intervento, apri(c, "intervento"));
        return v;
    }

    private static final int[] RIGHE = { R.id.w_a1, R.id.w_a2, R.id.w_a3, R.id.w_a4, R.id.w_a5 };
    private static final int[] PUNTI = { R.id.w_a1_p, R.id.w_a2_p, R.id.w_a3_p, R.id.w_a4_p, R.id.w_a5_p };
    private static final int[] TITOLI = { R.id.w_a1_t, R.id.w_a2_t, R.id.w_a3_t, R.id.w_a4_t, R.id.w_a5_t };
    private static final int[] GIORNI = { R.id.w_a1_d, R.id.w_a2_d, R.id.w_a3_d, R.id.w_a4_d, R.id.w_a5_d };

    /** Le scadenze di tutte le auto (fino a cinque), con il colore di quanto è urgente. */
    private static void riempiRighe(Context c, RemoteViews v, android.content.SharedPreferences p) {
        v.setTextViewText(R.id.w_intest, p.getString("intest", ""));
        org.json.JSONArray a;
        try { a = new org.json.JSONArray(p.getString("righe", "[]")); } catch (Exception e) { a = new org.json.JSONArray(); }
        for (int k = 0; k < RIGHE.length; k++) {
            org.json.JSONObject o = k < a.length() ? a.optJSONObject(k) : null;
            v.setViewVisibility(RIGHE[k], o != null ? android.view.View.VISIBLE : android.view.View.GONE);
            if (o == null) continue;
            int colore = "scaduta".equals(o.optString("l")) ? 0xFFF43F5E : "vicina".equals(o.optString("l")) ? 0xFFF59E0B : 0xFF10B981;
            v.setTextViewText(TITOLI[k], o.optString("t"));
            v.setTextViewText(GIORNI[k], o.optString("d"));
            v.setTextColor(PUNTI[k], colore);
            v.setTextColor(GIORNI[k], "ok".equals(o.optString("l")) ? 0xFF94A3B8 : colore);
        }
        v.setViewVisibility(R.id.w_vuoto, a.length() == 0 ? android.view.View.VISIBLE : android.view.View.GONE);
        v.setTextViewText(R.id.w_vuoto, p.getString("riga2", Testi.t("Tocca per aprire", "Tap to open")));
    }

    private static String corto(String s, int n) { return s == null ? "" : s.length() > n ? s.substring(0, n) : s; }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        Testi.carica(c);
        for (int id : ids) m.updateAppWidget(id, vista(c, R.layout.widget_doctorcar));
    }

    /** La pagina scrive la prossima scadenza (per il widget compatto), l'intestazione con i km e fino a cinque scadenze (per quello grande). */
    static void aggiorna(Context c, String riga1, String riga2, String intest, String righe) {
        // testi brevi e al massimo cinque righe: il widget non deve mai ricevere più di quanto mostra
        riga1 = corto(riga1, 120); riga2 = corto(riga2, 200); intest = corto(intest, 300);
        try { org.json.JSONArray in = new org.json.JSONArray(righe), out = new org.json.JSONArray();
            for (int k = 0; k < in.length() && k < 5; k++) { org.json.JSONObject o = in.optJSONObject(k); if (o == null) continue;
                org.json.JSONObject x = new org.json.JSONObject(); x.put("t", corto(o.optString("t"), 120)); x.put("d", corto(o.optString("d"), 30)); x.put("l", corto(o.optString("l"), 10)); out.put(x); }
            righe = out.toString(); } catch (Exception e) { righe = "[]"; }
        c.getSharedPreferences("doctorcar_widget", Context.MODE_PRIVATE).edit().putString("riga1", riga1).putString("riga2", riga2).putString("intest", intest).putString("righe", righe).apply();
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : m.getAppWidgetIds(new ComponentName(c, DoctorCarWidget.class))) m.updateAppWidget(id, vista(c, R.layout.widget_doctorcar));
        for (int id : m.getAppWidgetIds(new ComponentName(c, DoctorCarWidgetCompatto.class))) m.updateAppWidget(id, vista(c, R.layout.widget_doctorcar_compatto));
    }
}
