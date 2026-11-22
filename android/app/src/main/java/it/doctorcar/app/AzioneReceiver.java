package it.doctorcar.app;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;

import org.json.JSONObject;

/**
 * I tasti delle notifiche: «Fatto oggi», «Rimanda di una settimana» e la risposta con i km. Il lavoro vero lo fa la pagina
 * alla prossima apertura (Coda); qui si risponde subito all'utente e si tolgono gli avvisi che non servono più.
 */
public class AzioneReceiver extends BroadcastReceiver {
    static final String CONTROLLI = "it.doctorcar.app.CONTROLLI";
    static final String FATTO = "it.doctorcar.app.FATTO", RIMANDA = "it.doctorcar.app.RIMANDA", KM = "it.doctorcar.app.KM";
    static final String CAMPO_KM = "km";

    private void conferma(Context c, int idNotifica, String titolo, String testo) {
        Intent apri = new Intent(c, MainActivity.class);
        apri.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tocco = PendingIntent.getActivity(c, idNotifica, apri, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, Promemoria.CANALE)
                .setSmallIcon(R.drawable.ic_notifica).setColor(0xFFF59E0B)
                .setContentTitle(titolo).setContentText(testo)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setAutoCancel(true).setTimeoutAfter(6000).setContentIntent(tocco);
        try { NotificationManagerCompat.from(c).notify(idNotifica, b.build()); } catch (SecurityException ignored) { }
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        Testi.carica(c);
        if (intent == null || intent.getAction() == null) return;
        String id = intent.getStringExtra("id");
        if (id == null) return;
        int n = id.hashCode();
        String scadenza = String.valueOf(intent.getStringExtra("scadenza")), voce = String.valueOf(intent.getStringExtra("voce")), veicolo = String.valueOf(intent.getStringExtra("veicolo"));
        String titolo = String.valueOf(intent.getStringExtra("titolo")), testo = String.valueOf(intent.getStringExtra("testo"));
        try {
            switch (intent.getAction()) {
                case FATTO: {
                    JSONObject a = new JSONObject();
                    a.put("tipo", "fatto"); a.put("scadenza", scadenza); a.put("voce", voce); a.put("veicolo", veicolo); a.put("data", Coda.oggi());
                    Coda.aggiungi(c, a);
                    Promemoria.togliPerScadenza(c, scadenza);
                    conferma(c, n, Testi.t("Segnato ✓", "Done ✓"), titolo.replaceFirst("^[^:]*: ", "") + Testi.t(": lo trovi nel registro degli interventi.", ": you'll find it in the service log."));
                    break;
                }
                case CONTROLLI: {
                    JSONObject a = new JSONObject();
                    a.put("tipo", "controlli"); a.put("veicolo", veicolo); a.put("data", Coda.oggi());
                    Coda.aggiungi(c, a);
                    conferma(c, n, Testi.t("Segnato ✓", "Done ✓"), Testi.t("Controlli veloci: tutto a posto. Lo trovi nel registro.", "Quick checks: all good. You'll find it in the log."));
                    break;
                }
                case RIMANDA: {
                    JSONObject o = new JSONObject();
                    o.put("titolo", titolo); o.put("testo", testo); o.put("azione", "scadenza"); o.put("scadenza", scadenza); o.put("voce", voce); o.put("veicolo", veicolo);
                    Promemoria.rimanda(c, o);
                    NotificationManagerCompat.from(c).cancel(n);
                    break;
                }
                case KM: {
                    Bundle r = RemoteInput.getResultsFromIntent(intent);
                    CharSequence t = r != null ? r.getCharSequence(CAMPO_KM) : null;
                    String cifre = t == null ? "" : t.toString().replaceAll("[^0-9]", "");
                    long km = cifre.isEmpty() || cifre.length() > 7 ? -1 : Long.parseLong(cifre);
                    if (km <= 0 || km > 3000000L) { conferma(c, n, Testi.t("Non ho capito", "I didn't understand"), Testi.t("Scrivi solo il numero dei km, per esempio 54200.", "Write only the mileage number, for example 54200.")); break; }
                    JSONObject a = new JSONObject();
                    a.put("tipo", "km"); a.put("veicolo", veicolo); a.put("km", km); a.put("data", Coda.oggi());
                    Coda.aggiungi(c, a);
                    conferma(c, n, Testi.t("Km segnati ✓", "Mileage saved ✓"), String.format(Testi.inglese() ? java.util.Locale.UK : java.util.Locale.ITALY, "%,d km", km));
                    break;
                }
                default: break;
            }
        } catch (Exception ignored) { }
    }
}
