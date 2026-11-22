package it.doctorcar.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * I promemoria delle scadenze. La pagina calcola quando avvisare (date, ore, testi) e li consegna qui;
 * qui restano salvati e Android li fa scattare anche con l'app chiusa (AlarmManager), senza rete.
 * Dopo un riavvio del telefono o un aggiornamento dell'app si riprogrammano da soli (AvvioReceiver).
 * Ogni voce: { id, quando (ms), titolo, testo } e, se ha dei tasti nella notifica, { azione: 'scadenza'|'km', scadenza, voce, veicolo }.
 */
final class Promemoria {
    static final String CANALE = "scadenze";
    private static final String PREF = "doctorcar_promemoria";
    private static final String CHIAVE = "voci";
    private static final int MASSIMO = 80;

    private Promemoria() { }

    private static SharedPreferences pref(Context c) { return c.getSharedPreferences(PREF, Context.MODE_PRIVATE); }

    static void creaCanale(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CANALE, Testi.t("Scadenze", "Deadlines"), NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription(Testi.t("Avvisi su tagliando, revisione, bollo, assicurazione e altre scadenze", "Reminders for service, MOT, road tax, insurance and other deadlines"));
        nm.createNotificationChannel(ch);
    }

    private static PendingIntent intento(Context c, JSONObject o) {
        Intent i = new Intent(c, PromemoriaReceiver.class);
        i.setAction("it.doctorcar.app.PROMEMORIA");
        for (String k : new String[] { "id", "titolo", "testo", "azione", "scadenza", "voce", "veicolo" }) i.putExtra(k, o.optString(k, ""));
        return PendingIntent.getBroadcast(c, o.optString("id").hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static JSONArray lette(Context c) {
        try { return new JSONArray(pref(c).getString(CHIAVE, "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    private static void togliAllarmi(Context c, JSONArray voci) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int k = 0; k < voci.length(); k++) { try { am.cancel(intento(c, voci.getJSONObject(k))); } catch (Exception ignored) { } }
    }

    /** Toglie tutti i promemoria e le notifiche dei promemoria già mostrate. */
    static void annulla(Context c) {
        JSONArray v = lette(c);
        togliAllarmi(c, v);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        for (int k = 0; k < v.length(); k++) if (nm != null) nm.cancel(v.optJSONObject(k) != null ? v.optJSONObject(k).optString("id").hashCode() : 0);
        pref(c).edit().remove(CHIAVE).apply();
    }

    /**
     * Sostituisce i promemoria con quelli nuovi. Quelli «rimandati» dall'utente (id con «:r») restano, finché non scattano.
     * Risponde quanti ne ha programmati.
     */
    static int imposta(Context c, JSONArray nuove) throws Exception {
        JSONArray vecchie = lette(c), rimandati = new JSONArray();
        long ora = System.currentTimeMillis();
        for (int k = 0; k < vecchie.length(); k++) {
            JSONObject o = vecchie.getJSONObject(k);
            if (o.optString("id").contains(":r") && o.optLong("quando") > ora) rimandati.put(o);
        }
        togliAllarmi(c, vecchie);
        JSONArray tenute = new JSONArray();
        for (int k = 0; k < rimandati.length(); k++) tenute.put(rimandati.getJSONObject(k));
        for (int k = 0; k < nuove.length() && tenute.length() < MASSIMO; k++) {
            JSONObject o = nuove.getJSONObject(k);
            String id = o.optString("id", "");
            long quando = o.optLong("quando", 0);
            if (id.isEmpty() || id.length() > 80 || quando <= ora) continue;
            JSONObject v = new JSONObject();
            v.put("id", id); v.put("quando", quando);
            v.put("titolo", limita(o.optString("titolo", "DoctorCar"), 80)); v.put("testo", limita(o.optString("testo", ""), 200));
            String azione = o.optString("azione", "");
            if ("scadenza".equals(azione) || "km".equals(azione) || "controlli".equals(azione)) {
                v.put("azione", azione); v.put("scadenza", limita(o.optString("scadenza", ""), 40));
                v.put("voce", limita(o.optString("voce", ""), 40)); v.put("veicolo", limita(o.optString("veicolo", ""), 40));
            }
            tenute.put(v);
        }
        pref(c).edit().putString(CHIAVE, tenute.toString()).apply();
        creaCanale(c);
        programma(c, tenute);
        return tenute.length();
    }

    private static String limita(String s, int n) { return s.length() > n ? s.substring(0, n) : s; }

    private static void programma(Context c, JSONArray voci) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long ora = System.currentTimeMillis();
        for (int k = 0; k < voci.length(); k++) {
            try {
                JSONObject o = voci.getJSONObject(k);
                long quando = o.getLong("quando");
                if (quando <= ora) continue;
                // senza permesso per le sveglie esatte: Android può spostarla di poco, va bene per un promemoria
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quando, intento(c, o));
            } catch (Exception ignored) { }
        }
    }

    /** «Fatto»: via i promemoria ancora in programma di quella scadenza. */
    static void togliPerScadenza(Context c, String scadenza) {
        if (scadenza == null || scadenza.isEmpty()) return;
        JSONArray v = lette(c), resto = new JSONArray(), via = new JSONArray();
        for (int k = 0; k < v.length(); k++) {
            JSONObject o = v.optJSONObject(k);
            if (o != null && scadenza.equals(o.optString("scadenza"))) via.put(o); else if (o != null) resto.put(o);
        }
        togliAllarmi(c, via);
        pref(c).edit().putString(CHIAVE, resto.toString()).apply();
    }

    /** «Rimanda di una settimana»: lo stesso avviso fra 7 giorni. */
    static void rimanda(Context c, JSONObject o) {
        try {
            JSONObject n = new JSONObject(o.toString());
            long fra = System.currentTimeMillis() + 7L * 86400000L;
            n.put("id", o.optString("scadenza", "x") + ":r" + fra); n.put("quando", fra);
            JSONArray v = lette(c); v.put(n);
            pref(c).edit().putString(CHIAVE, v.toString()).apply();
            creaCanale(c);
            JSONArray solo = new JSONArray(); solo.put(n);
            programma(c, solo);
        } catch (Exception ignored) { }
    }

    /** Dopo un riavvio o un aggiornamento: rimette in programma quelli che non sono ancora scattati. */
    static void riprogramma(Context c) {
        creaCanale(c);
        programma(c, lette(c));
    }
}
