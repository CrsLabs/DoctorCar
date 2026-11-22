package it.doctorcar.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Dopo il riavvio del telefono o l'aggiornamento dell'app Android dimentica le sveglie: qui si rimettono. */
public class AvvioReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        Testi.carica(c);
        if (intent == null) return;
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) Promemoria.riprogramma(c);
    }
}
