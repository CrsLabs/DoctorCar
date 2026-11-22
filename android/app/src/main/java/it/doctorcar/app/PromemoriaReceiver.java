package it.doctorcar.app;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;

/** Scatta all'ora del promemoria e mostra la notifica (con i tasti «Fatto oggi» e «Rimanda», o con la risposta per i km); toccandola si apre DoctorCar. */
public class PromemoriaReceiver extends BroadcastReceiver {
    static PendingIntent tasto(Context c, Intent da, String azione, boolean modificabile, int tipo) {
        Intent i = new Intent(c, AzioneReceiver.class);
        i.setAction(azione);
        for (String k : new String[] { "id", "titolo", "testo", "scadenza", "voce", "veicolo" }) i.putExtra(k, da.getStringExtra(k));
        int flag = PendingIntent.FLAG_UPDATE_CURRENT | (modificabile ? (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0) : PendingIntent.FLAG_IMMUTABLE);
        return PendingIntent.getBroadcast(c, String.valueOf(da.getStringExtra("id")).hashCode() * 31 + tipo, i, flag);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        Testi.carica(c);
        if (intent == null) return;
        String id = intent.getStringExtra("id");
        if (id == null) return;
        if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) return;
        Promemoria.creaCanale(c);
        Intent apri = new Intent(c, MainActivity.class);
        apri.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        // i controlli veloci: toccando la notifica si apre direttamente la lista
        if ("controlli".equals(intent.getStringExtra("azione"))) apri.putExtra("scorciatoia", "controlli");
        PendingIntent tocco = PendingIntent.getActivity(c, id.hashCode(), apri, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String testo = intent.getStringExtra("testo"), azione = intent.getStringExtra("azione");
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, Promemoria.CANALE)
                .setSmallIcon(R.drawable.ic_notifica)
                .setColor(0xFFF59E0B)
                .setContentTitle(intent.getStringExtra("titolo"))
                .setContentText(testo)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(testo))
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setAutoCancel(true)
                .setContentIntent(tocco);
        if ("scadenza".equals(azione)) {
            b.addAction(0, Testi.t("Fatto oggi", "Done today"), tasto(c, intent, AzioneReceiver.FATTO, false, 1));
            b.addAction(0, Testi.t("Rimanda di una settimana", "Postpone one week"), tasto(c, intent, AzioneReceiver.RIMANDA, false, 2));
        } else if ("controlli".equals(azione)) {
            b.addAction(0, Testi.t("Tutto a posto", "All good"), tasto(c, intent, AzioneReceiver.CONTROLLI, false, 4));
        } else if ("km".equals(azione)) {
            RemoteInput ri = new RemoteInput.Builder(AzioneReceiver.CAMPO_KM).setLabel(Testi.t("Km sul contachilometri", "Odometer reading")).build();
            b.addAction(new NotificationCompat.Action.Builder(0, Testi.t("Scrivi i km", "Enter mileage"), tasto(c, intent, AzioneReceiver.KM, true, 3)).addRemoteInput(ri).build());
        }
        try { NotificationManagerCompat.from(c).notify(id.hashCode(), b.build()); } catch (SecurityException ignored) { }
    }
}
