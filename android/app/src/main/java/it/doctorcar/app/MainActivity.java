package it.doctorcar.app;

import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.LocaleList;

import java.util.Locale;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // L'app è in italiano: anche i campi data (calendario, «gg/mm/aaaa») e i numeri della WebView seguono l'italiano,
    // qualunque sia la lingua del telefono.
    @Override
    protected void attachBaseContext(Context base) {
        Locale it = Locale.ITALY;
        Locale.setDefault(it);
        LocaleList.setDefault(new LocaleList(it));
        Configuration c = new Configuration(base.getResources().getConfiguration());
        c.setLocales(new LocaleList(it));
        super.attachBaseContext(base.createConfigurationContext(c));
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DoctorCarPlugin.class);
        registerPlugin(pairwood.capacitor.PairWoodPlugin.class);   // sincronizzazione diretta (PairWood)
        super.onCreate(savedInstanceState);
        ricorda(getIntent());
        // nell'elenco delle app recenti non si vede il contenuto (dati dell'auto): da Android 13
        if (android.os.Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false);
        avvisaTastiera();
        // niente «stiramento» di Android su tutta la schermata quando si tira oltre la fine: si ferma e basta (lo scorrimento resta)
        if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // la pagina sa se è «dentro» una finestra o una sezione: in quel caso gestisce lei Indietro (una volta sola);
                // dalla Home l'app va in secondo piano
                final android.webkit.WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv == null) { moveTaskToBack(true); return; }
                wv.evaluateJavascript("(function(){try{return window.__indietroNativo?window.__indietroNativo():false}catch(e){return false}})()",
                    r -> { if (!"true".equals(r)) moveTaskToBack(true); });
            }
        });
    }

    /** La scorciatoia (icona o widget) con cui l'app è stata aperta; la pagina la prende una volta sola. */
    private static String scorciatoia = "";
    static synchronized String prelevaScorciatoia() { String s = scorciatoia; scorciatoia = ""; return s; }
    private static synchronized void ricorda(android.content.Intent i) {
        String s = i == null ? null : i.getStringExtra("scorciatoia");
        if (s != null && s.matches("[a-z]{0,20}")) scorciatoia = s;
    }
    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        ricorda(intent);
        if (intent != null && intent.getStringExtra("scorciatoia") != null) alla("__scorciatoia");
    }

    /** Chiama una funzione della pagina (se c'è). */
    private void alla(String funzione) {
        final android.webkit.WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null) wv.post(() -> wv.evaluateJavascript("window." + funzione + "&&window." + funzione + "()", null));
    }
    /** Messa in pausa da Android (app recenti, Home, schermo spento): la pagina si copre; al ritorno chiede l'impronta. Le finestre affiancate e la tendina delle notifiche non fermano l'app: non contano. */
    private boolean pausata = false;
    @Override
    public void onPause() { pausata = !isChangingConfigurations() && !isInMultiWindowMode(); if (pausata) alla("__pausaApp"); super.onPause(); }
    @Override
    public void onResume() { super.onResume(); if (pausata) { pausata = false; alla("__pausaApp"); alla("__ripresaApp"); } }
    /** Il gesto delle app recenti toglie all'app il primo piano (anche senza fermarla): conta come uscire. */
    @Override
    public void onTopResumedActivityChanged(boolean primoPiano) {
        super.onTopResumedActivityChanged(primoPiano);
        if (!primoPiano) { if (!isInMultiWindowMode() && !isChangingConfigurations() && !pausata) { pausata = true; alla("__pausaApp"); } }
        else if (pausata) { pausata = false; alla("__pausaApp"); alla("__ripresaApp"); }
    }

    /** Dice alla pagina quanto della finestra è coperto dalla tastiera (px della pagina): la barra in basso si nasconde. */
    private int tastieraVista = -1;
    private void avvisaTastiera() {
        final android.view.View dv = getWindow().getDecorView();
        androidx.core.view.ViewCompat.setWindowInsetsAnimationCallback(dv,
            new androidx.core.view.WindowInsetsAnimationCompat.Callback(androidx.core.view.WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
                @Override
                public androidx.core.view.WindowInsetsCompat onProgress(androidx.core.view.WindowInsetsCompat insets,
                                                                        java.util.List<androidx.core.view.WindowInsetsAnimationCompat> animazioni) {
                    dallaTastiera(insets);
                    return insets;
                }
                @Override
                public void onEnd(androidx.core.view.WindowInsetsAnimationCompat animazione) {
                    dallaTastiera(androidx.core.view.ViewCompat.getRootWindowInsets(dv));
                }
            });
    }
    private void dallaTastiera(androidx.core.view.WindowInsetsCompat wi) {
        if (wi == null) return;
        int kb = wi.isVisible(androidx.core.view.WindowInsetsCompat.Type.ime()) ? wi.getInsets(androidx.core.view.WindowInsetsCompat.Type.ime()).bottom : 0;
        if (kb == tastieraVista) return;
        tastieraVista = kb;
        final android.webkit.WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv == null) return;
        final int px = Math.round(kb / getResources().getDisplayMetrics().density);
        wv.post(() -> wv.evaluateJavascript("window.__tastiera&&window.__tastiera(" + px + ")", null));
    }
}
