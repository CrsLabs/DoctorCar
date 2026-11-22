package it.doctorcar.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Le cose fatte dalle notifiche (o da fuori dall'app) mentre la pagina non era aperta: «Fatto oggi», i km scritti nella
 * risposta. I dati dell'app stanno nella pagina, quindi qui si accodano e la pagina le applica alla prossima apertura.
 */
final class Coda {
    private static final String PREF = "doctorcar_coda", CHIAVE = "azioni";
    private Coda() { }

    private static SharedPreferences pref(Context c) { return c.getSharedPreferences(PREF, Context.MODE_PRIVATE); }

    static synchronized void aggiungi(Context c, JSONObject azione) {
        try {
            JSONArray a = new JSONArray(pref(c).getString(CHIAVE, "[]"));
            if (a.length() >= 100) return;
            a.put(azione);
            pref(c).edit().putString(CHIAVE, a.toString()).apply();
        } catch (Exception ignored) { }
    }

    /** Le azioni in attesa; la coda si svuota. */
    static synchronized JSONArray preleva(Context c) {
        try {
            JSONArray a = new JSONArray(pref(c).getString(CHIAVE, "[]"));
            pref(c).edit().remove(CHIAVE).apply();
            return a;
        } catch (Exception e) { return new JSONArray(); }
    }

    static String oggi() {
        java.util.Calendar k = java.util.Calendar.getInstance();
        return String.format(java.util.Locale.ROOT, "%04d-%02d-%02d", k.get(java.util.Calendar.YEAR), k.get(java.util.Calendar.MONTH) + 1, k.get(java.util.Calendar.DAY_OF_MONTH));
    }
}
