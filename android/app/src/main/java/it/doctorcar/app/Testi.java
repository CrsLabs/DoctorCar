package it.doctorcar.app;

import android.content.Context;

/**
 * La lingua della parte Android (notifiche, widget, fotocamera): la stessa scelta nella pagina, che la comunica con
 * {@code lingua({ inglese })}. Si ricorda, così vale anche con l'app chiusa (promemoria, widget).
 */
final class Testi {
    private Testi() { }
    private static final String PREF = "doctorcar_aspetto";
    private static volatile boolean en = false;

    static void carica(Context c) {
        try { en = c.getSharedPreferences(PREF, Context.MODE_PRIVATE).getBoolean("inglese", false); } catch (Exception ignorata) { }
    }

    static void imposta(Context c, boolean inglese) {
        en = inglese;
        c.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().putBoolean("inglese", inglese).apply();
    }

    static boolean inglese() { return en; }

    /** il testo nella lingua scelta */
    static String t(String it, String en) { return Testi.en ? en : it; }
}
