package it.doctorcar.app;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.Display;
import android.view.Window;
import android.view.WindowManager;

import androidx.activity.result.ActivityResult;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.OutputStream;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Le funzioni native di DoctorCar per la pagina:
 *  - custodia di una chiave nel Keystore di Android (legata all'hardware): protegge la chiave e il codice della sincronizzazione;
 *  - «Salva come» di Android per la copia di sicurezza e la tabella CSV;
 *  - vibrazione leggera dei tasti;
 *  - cancellazione di ogni dato dell'app.
 *  - aggiornamenti dell'app da GitHub (una lettura a settimana, si può spegnere): unica rete usata qui;
 *    il resto della rete la usa solo PairWood, per parlare con i dispositivi abbinati.
 */
@CapacitorPlugin(name = "DoctorCar", permissions = { @com.getcapacitor.annotation.Permission(alias = "fotocamera", strings = { android.Manifest.permission.CAMERA }),
        @com.getcapacitor.annotation.Permission(alias = "posizione", strings = { android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION }) })
public class DoctorCarPlugin extends Plugin {

    // ===================== DIMENSIONE DEL TESTO =====================
    // Lo zoom del testo della WebView (come la grandezza dei caratteri di Android): cresce solo il testo, l'impaginazione
    // va a capo. Si ricorda qui, così all'apertura dell'app il testo è subito della dimensione giusta.
    private static final String PREF = "doctorcar_aspetto";

    @Override
    public void load() {
        Testi.carica(getContext());
        int p = getContext().getSharedPreferences(PREF, Context.MODE_PRIVATE).getInt("testo", 100);
        if (p != 100 && getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().getSettings().setTextZoom(p);
    }

    /** dimensioneTesto({ percento: 100 | 115 | 130 }) */
    @PluginMethod
    public void dimensioneTesto(PluginCall call) {
        Integer p = call.getInt("percento");
        if (p == null || (p != 100 && p != 115 && p != 130)) { call.reject("dimensione non valida"); return; }
        getContext().getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().putInt("testo", p).apply();
        getActivity().runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().getSettings().setTextZoom(p);
            call.resolve();
        });
    }

    // ===================== FREQUENZA DELLO SCHERMO =====================

    private Display schermo() {
        Activity a = getActivity();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) return a.getDisplay();
        //noinspection deprecation
        return a.getWindowManager().getDefaultDisplay();
    }

    /** frequenze() -> { massima, minima, attuale } in Hz, per i modi con la stessa risoluzione */
    @PluginMethod
    public void frequenze(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Display d = schermo();
                Display.Mode ora = d.getMode();
                float max = ora.getRefreshRate(), min = ora.getRefreshRate();
                for (Display.Mode m : d.getSupportedModes()) {
                    if (m.getPhysicalWidth() != ora.getPhysicalWidth() || m.getPhysicalHeight() != ora.getPhysicalHeight()) continue;
                    max = Math.max(max, m.getRefreshRate());
                    min = Math.min(min, m.getRefreshRate());
                }
                JSObject r = new JSObject();
                r.put("massima", Math.round(max));
                r.put("minima", Math.round(min));
                r.put("attuale", Math.round(d.getRefreshRate()));
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Frequenza non disponibile", "ERRORE", e);
            }
        });
    }

    /** impostaFrequenza({ modo: 'auto' | 'massima' | '60' }) */
    @PluginMethod
    public void impostaFrequenza(PluginCall call) {
        String modo = call.getString("modo", "auto");
        getActivity().runOnUiThread(() -> {
            try {
                Window w = getActivity().getWindow();
                WindowManager.LayoutParams lp = w.getAttributes();
                Display d = schermo();
                Display.Mode ora = d.getMode(), scelto = null;
                if (!"auto".equals(modo)) {
                    float obiettivo = "60".equals(modo) ? 60f : Float.MAX_VALUE;
                    for (Display.Mode m : d.getSupportedModes()) {
                        if (m.getPhysicalWidth() != ora.getPhysicalWidth() || m.getPhysicalHeight() != ora.getPhysicalHeight()) continue;
                        if (scelto == null || Math.abs(m.getRefreshRate() - obiettivo) < Math.abs(scelto.getRefreshRate() - obiettivo)) scelto = m;
                    }
                }
                lp.preferredDisplayModeId = scelto == null ? 0 : scelto.getModeId();
                lp.preferredRefreshRate = scelto == null ? 0 : scelto.getRefreshRate();
                w.setAttributes(lp);
                JSObject r = new JSObject();
                r.put("hz", scelto == null ? 0 : Math.round(scelto.getRefreshRate()));
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Frequenza non impostata", "ERRORE", e);
            }
        });
    }

    // ===================== CUSTODIA (Keystore) =====================

    private static final String ALIAS_CUSTODIA = "doctorcar_custodia_v1";

    private SecretKey chiaveCustodia() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS_CUSTODIA)) return (SecretKey) ks.getKey(ALIAS_CUSTODIA, null);
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(ALIAS_CUSTODIA, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return kg.generateKey();
    }

    /** custodisci({ dati: base64 }) -> { iv, dati } */
    @PluginMethod
    public void custodisci(PluginCall call) {
        String d = call.getString("dati");
        if (d == null) { call.reject("Mancano i dati", "DATI"); return; }
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, chiaveCustodia());
            byte[] out = c.doFinal(Base64.decode(d, Base64.NO_WRAP));
            JSObject r = new JSObject();
            r.put("iv", Base64.encodeToString(c.getIV(), Base64.NO_WRAP));
            r.put("dati", Base64.encodeToString(out, Base64.NO_WRAP));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Custodia non riuscita: " + e.getMessage(), "ERRORE", e);
        }
    }

    /** riprendi({ iv, dati }) -> { dati: base64 } */
    @PluginMethod
    public void riprendi(PluginCall call) {
        String iv = call.getString("iv"), d = call.getString("dati");
        if (iv == null || d == null) { call.reject("Mancano i dati", "DATI"); return; }
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, chiaveCustodia(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            JSObject r = new JSObject();
            r.put("dati", Base64.encodeToString(c.doFinal(Base64.decode(d, Base64.NO_WRAP)), Base64.NO_WRAP));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Dato custodito non leggibile", "ERRORE", e);
        }
    }

    // ===================== FILE =====================

    /** salvaFile({ nome, mime, dati: base64 }) -> { salvato } — finestra «Salva come» di Android */
    @PluginMethod
    public void salvaFile(PluginCall call) {
        if (call.getString("dati") == null) { call.reject("Mancano i dati", "DATI"); return; }
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(call.getString("mime", "application/octet-stream"));
        i.putExtra(Intent.EXTRA_TITLE, call.getString("nome", "doctorcar"));
        startActivityForResult(call, i, "fileScelto");
    }

    @ActivityCallback
    private void fileScelto(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            r.put("salvato", false);
            call.resolve(r);
            return;
        }
        Uri uri = result.getData().getData();
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new Exception("destinazione non scrivibile");
            out.write(Base64.decode(call.getString("dati"), Base64.NO_WRAP));
            r.put("salvato", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Salvataggio non riuscito: " + e.getMessage(), "ERRORE", e);
        }
    }

    // ===================== VIBRAZIONE =====================

    // tempi = [vibra, pausa, vibra, ...] in ms; forza 0,4–2,5: dove il telefono lo permette regola anche
    // l'intensità del motore (non solo la durata), così «Leggera» e «Forte» si sentono davvero diverse.
    @PluginMethod
    public void vibra(PluginCall call) {
        try {
            org.json.JSONArray t = call.getArray("tempi");
            double forza = call.getDouble("forza", 1.0);
            if (t == null || t.length() == 0) { call.resolve(); return; }
            android.os.Vibrator v;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                android.os.VibratorManager vm = (android.os.VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                v = vm.getDefaultVibrator();
            } else {
                //noinspection deprecation
                v = (android.os.Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (v == null || !v.hasVibrator()) { call.resolve(); return; }
            // un tocco su tasti e selettori: il «clic» aptico di Android, fatto apposta per i tasti (un impulso breve e debole
            // su molti telefoni quasi non si sente). L'intensità scelta decide quale clic: leggero, normale o deciso.
            if ("scelta".equals(call.getString("tipo", "")) && Build.VERSION.SDK_INT >= 29) {
                int effetto = forza < 0.75 ? android.os.VibrationEffect.EFFECT_TICK : forza < 1.6 ? android.os.VibrationEffect.EFFECT_CLICK : android.os.VibrationEffect.EFFECT_HEAVY_CLICK;
                v.vibrate(android.os.VibrationEffect.createPredefined(effetto));
                call.resolve();
                return;
            }
            int n = Math.min(t.length(), 20);
            long[] tempi = new long[n + 1];
            int[] ampiezze = new int[n + 1];
            int amp = (int) Math.round(Math.max(1, Math.min(255, 110 + (Math.max(0.4, Math.min(2.5, forza)) - 0.4) / 2.1 * 145)));
            tempi[0] = 0; ampiezze[0] = 0;   // si parte subito
            for (int i = 0; i < n; i++) {
                tempi[i + 1] = Math.max(1, Math.min(1000, t.getLong(i)));
                ampiezze[i + 1] = i % 2 == 0 ? (v.hasAmplitudeControl() ? amp : android.os.VibrationEffect.DEFAULT_AMPLITUDE) : 0;
            }
            v.vibrate(android.os.VibrationEffect.createWaveform(tempi, ampiezze, -1));
            call.resolve();
        } catch (Exception e) {
            call.reject("Vibrazione non riuscita", "ERRORE", e);
        }
    }

    // ===================== IMPRONTA O PIN DEL TELEFONO =====================

    private int autenticatori() {
        // impronta (o volto) forte; se non va, il PIN/sequenza/password del telefono
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                : BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
    }

    private boolean puoVerificare() {
        return BiometricManager.from(getContext()).canAuthenticate(autenticatori()) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    /** Quando è stata confermata l'ultima volta l'identità (impronta o PIN): serve alle azioni distruttive native. */
    static volatile long ultimaIdentita = 0;

    /** puoSbloccare() -> { ok } : c'è un modo per verificare chi tiene il telefono (impronta o PIN del telefono) */
    @PluginMethod
    public void puoSbloccare(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ok", puoVerificare());
        call.resolve(r);
    }

    /** verificaIdentita({ titolo?, sottotitolo? }) — impronta, oppure il PIN del telefono; nessuna chiave in gioco */
    @PluginMethod
    public void verificaIdentita(PluginCall call) {
        String titolo = call.getString("titolo", "DoctorCar");
        String sottotitolo = call.getString("sottotitolo", Testi.t("Sblocca per continuare", "Unlock to continue"));
        Activity a = getActivity();
        if (!(a instanceof FragmentActivity)) { call.reject("Sblocco non disponibile", "ERRORE"); return; }
        a.runOnUiThread(() -> {
            try {
                BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(titolo)
                        .setSubtitle(sottotitolo)
                        .setAllowedAuthenticators(autenticatori())
                        .setConfirmationRequired(false)
                        .build();
                new BiometricPrompt((FragmentActivity) a, ContextCompat.getMainExecutor(a), new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        ultimaIdentita = android.os.SystemClock.elapsedRealtime();
                        call.resolve();
                    }

                    @Override
                    public void onAuthenticationError(int codice, CharSequence msg) {
                        call.reject(String.valueOf(msg), codice == BiometricPrompt.ERROR_USER_CANCELED || codice == BiometricPrompt.ERROR_CANCELED
                                || codice == BiometricPrompt.ERROR_NEGATIVE_BUTTON ? "ANNULLATO" : "ERRORE");
                    }
                }).authenticate(info);
            } catch (Exception e) {
                call.reject("Sblocco non disponibile: " + e.getMessage(), "ERRORE", e);
            }
        });
    }

    // ===================== PROMEMORIA (notifiche delle scadenze) =====================

    /** programmaPromemoria({ voci: [{ id, quando (ms), titolo, testo }] }) -> { programmati } — sostituisce i promemoria di prima */
    @PluginMethod
    public void programmaPromemoria(PluginCall call) {
        try {
            org.json.JSONArray voci = call.getArray("voci");
            if (voci == null) { call.reject("Mancano i promemoria", "DATI"); return; }
            JSObject r = new JSObject();
            r.put("programmati", Promemoria.imposta(getContext(), voci));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Promemoria non programmati: " + e.getMessage(), "ERRORE", e);
        }
    }

    /** annullaPromemoria() — toglie tutti i promemoria e le notifiche già mostrate */
    @PluginMethod
    public void annullaPromemoria(PluginCall call) {
        Promemoria.annulla(getContext());
        call.resolve();
    }

    /** statoNotifiche() -> { concesso } — Android permette le notifiche di DoctorCar? */
    @PluginMethod
    public void statoNotifiche(PluginCall call) {
        JSObject r = new JSObject();
        r.put("concesso", androidx.core.app.NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        call.resolve(r);
    }

    /** apriImpostazioniNotifiche() — apre le impostazioni delle notifiche di DoctorCar in Android */
    @PluginMethod
    public void apriImpostazioniNotifiche(PluginCall call) {
        try {
            Intent i = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Impostazioni non disponibili", "ERRORE", e);
        }
    }

    // ===================== FOTOCAMERA =====================
    // scattaFoto({ massimo? }) -> { foto: [{ nome, dati: base64 }] } oppure { annullato: true }
    // La fotocamera dell'app (CameraX); se la si sceglie, o se non funziona, quella del telefono.

    @PluginMethod
    public void scattaFoto(PluginCall call) {
        if (getPermissionState("fotocamera") != com.getcapacitor.PermissionState.GRANTED) { requestPermissionForAlias("fotocamera", call, "permessoFotocamera"); return; }
        apriFotocamera(call);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void permessoFotocamera(PluginCall call) {
        if (getPermissionState("fotocamera") == com.getcapacitor.PermissionState.GRANTED) apriFotocamera(call);
        else call.reject("Permesso della fotocamera negato", "PERMESSO");
    }

    private void apriFotocamera(PluginCall call) {
        Intent i = new Intent(getContext(), FotocameraActivity.class);
        i.putExtra(FotocameraActivity.EXTRA_MASSIMO, call.getInt("massimo", 12));
        startActivityForResult(call, i, "fotoScattate");
    }

    @ActivityCallback
    private void fotoScattate(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() == FotocameraActivity.RISULTATO_SISTEMA) { apriFotocameraSistema(call); return; }
        String[] percorsi = result.getData() != null ? result.getData().getStringArrayExtra(FotocameraActivity.EXTRA_FOTO) : null;
        if (result.getResultCode() != Activity.RESULT_OK || percorsi == null || percorsi.length == 0) {
            JSObject r = new JSObject(); r.put("annullato", true); call.resolve(r); return;
        }
        consegnaFoto(call, percorsi);
    }

    private File fotoSistema;

    private void apriFotocameraSistema(PluginCall call) {
        try {
            File cartella = getContext().getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES);
            if (cartella == null) throw new Exception("memoria non disponibile");
            //noinspection ResultOfMethodCallIgnored
            cartella.mkdirs();
            fotoSistema = new File(cartella, "JPEG_" + System.currentTimeMillis() + ".jpg");
            Uri uri = androidx.core.content.FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", fotoSistema);
            Intent i = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
            i.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, uri);
            i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(call, i, "fotoSistemaScattata");
        } catch (Exception e) {
            call.reject("Fotocamera del telefono non disponibile: " + e.getMessage(), "ERRORE", e);
        }
    }

    @ActivityCallback
    private void fotoSistemaScattata(PluginCall call, ActivityResult result) {
        if (call == null) return;
        File f = fotoSistema;
        fotoSistema = null;
        if (result.getResultCode() != Activity.RESULT_OK || f == null || !f.exists() || f.length() == 0) {
            if (f != null) //noinspection ResultOfMethodCallIgnored
                f.delete();
            JSObject r = new JSObject(); r.put("annullato", true); call.resolve(r); return;
        }
        try {
            File cartella = new File(getContext().getCacheDir(), "scatti");
            //noinspection ResultOfMethodCallIgnored
            cartella.mkdirs();
            File pronta = new File(cartella, "foto_" + System.currentTimeMillis() + ".jpg");
            FotoUtil.prepara(f, pronta);   // ridotta e raddrizzata come quelle della nostra fotocamera
            //noinspection ResultOfMethodCallIgnored
            f.delete();
            consegnaFoto(call, new String[] { pronta.getAbsolutePath() });
        } catch (Exception e) {
            call.reject("Foto non leggibile: " + e.getMessage(), "ERRORE", e);
        }
    }

    private void consegnaFoto(PluginCall call, String[] percorsi) {
        com.getcapacitor.JSArray l = new com.getcapacitor.JSArray();
        int n = 0;
        for (String p : percorsi) {
            File f = new File(p);
            // solo i file che la fotocamera ha scritto nella cache dell'app
            if (!f.getParentFile().getName().equals("scatti") || !f.exists()) continue;
            try (java.io.FileInputStream in = new java.io.FileInputStream(f)) {
                byte[] b = new byte[(int) f.length()];
                int letti = 0;
                while (letti < b.length) { int k = in.read(b, letti, b.length - letti); if (k < 0) break; letti += k; }
                JSObject o = new JSObject();
                o.put("nome", "foto-" + (++n) + ".jpg");
                o.put("dati", Base64.encodeToString(b, 0, letti, Base64.NO_WRAP));
                l.put(o);
            } catch (Exception ignored) {
            } finally {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
        JSObject r = new JSObject();
        r.put("foto", l);
        call.resolve(r);
    }

    // ===================== POSIZIONE (dove ho parcheggiato) =====================
    // posizione() -> { lat, lon, precisione } — una sola lettura, solo quando la chiedi tu; non resta niente nel telefono oltre all'app

    @PluginMethod
    public void posizione(PluginCall call) {
        if (getPermissionState("posizione") != com.getcapacitor.PermissionState.GRANTED) { requestPermissionForAlias("posizione", call, "permessoPosizione"); return; }
        leggiPosizione(call);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void permessoPosizione(PluginCall call) {
        if (getPermissionState("posizione") == com.getcapacitor.PermissionState.GRANTED) leggiPosizione(call);
        else call.reject("Permesso della posizione negato", "PERMESSO");
    }

    private JSObject comePosizione(android.location.Location l) {
        JSObject r = new JSObject();
        r.put("lat", l.getLatitude()); r.put("lon", l.getLongitude()); r.put("precisione", l.hasAccuracy() ? l.getAccuracy() : 0);
        // solo la posizione «approssimativa» concessa (Android 12+): la precisione non può migliorare
        r.put("approssimata", androidx.core.content.ContextCompat.checkSelfPermission(getContext(), android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED);
        return r;
    }

    /** La lettura più PRECISA tra quelle recenti (ultimi 2 minuti) di tutte le fonti: per esempio quella appena trovata da Mappe. */
    private static android.location.Location ultimaNota(android.location.LocationManager lm) {
        android.location.Location best = null;
        for (String p : lm.getProviders(true)) {
            try {
                android.location.Location l = lm.getLastKnownLocation(p);
                if (l == null || System.currentTimeMillis() - l.getTime() > 120000) continue;
                if (best == null || (l.hasAccuracy() && (!best.hasAccuracy() || l.getAccuracy() < best.getAccuracy()))) best = l;
            } catch (SecurityException ignored) { }
        }
        return best;
    }

    private void leggiPosizione(final PluginCall call) {
        final android.location.LocationManager lm = (android.location.LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) { call.reject("Posizione non disponibile", "ERRORE"); return; }
        if (!lm.isLocationEnabled()) { call.reject("La posizione del telefono è spenta", "SPENTA"); return; }
        if (call.getBoolean("preciso", false)) { affinaConGps(call, lm); return; }
        // Si chiede a TUTTE le fonti accese insieme (quella combinata di Android, la rete, il GPS) e vince la prima che risponde:
        // il GPS appena acceso ci mette anche più di 20 secondi a trovare i satelliti (al chiuso a volte non li trova),
        // mentre la rete risponde in pochi secondi. Dopo 30 secondi si usa la migliore posizione recente del telefono.
        final java.util.List<String> fonti = new java.util.ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31 && lm.getAllProviders().contains(android.location.LocationManager.FUSED_PROVIDER)
                && lm.isProviderEnabled(android.location.LocationManager.FUSED_PROVIDER)) fonti.add(android.location.LocationManager.FUSED_PROVIDER);
        if (lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER)) fonti.add(android.location.LocationManager.NETWORK_PROVIDER);
        if (lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)) fonti.add(android.location.LocationManager.GPS_PROVIDER);
        if (fonti.isEmpty()) { call.reject("La posizione del telefono è spenta", "SPENTA"); return; }
        // c'è già una lettura recente e precisa (per esempio Mappe l'ha appena trovata): si usa subito quella
        try { android.location.Location r = ultimaNota(lm); if (r != null && r.hasAccuracy() && r.getAccuracy() <= 20) { call.resolve(comePosizione(r)); return; } } catch (Exception ignorata) { }
        final boolean[] fatto = { false };
        final int[] senzaRisposta = { fonti.size() };
        final android.os.Handler h = new android.os.Handler(android.os.Looper.getMainLooper());
        final java.util.List<android.location.LocationListener> ascolti = new java.util.ArrayList<>();
        final Runnable smetti = () -> { for (android.location.LocationListener x : ascolti) { try { lm.removeUpdates(x); } catch (Exception ignorata) { } } };
        final Runnable scaduto = () -> {
            if (fatto[0]) return; fatto[0] = true; smetti.run();
            android.location.Location u = ultimaNota(lm);
            if (u != null) call.resolve(comePosizione(u)); else call.reject("Posizione non trovata", "TEMPO");
        };
        h.postDelayed(scaduto, 30000);
        final java.util.function.Consumer<android.location.Location> arrivata = l -> {
            if (fatto[0]) return;
            if (l == null) { if (--senzaRisposta[0] <= 0) { h.removeCallbacks(scaduto); scaduto.run(); } return; }   // tutte senza risposta: subito l'ultima nota
            fatto[0] = true; h.removeCallbacks(scaduto); smetti.run();
            call.resolve(comePosizione(l));
        };
        try {
            for (String prov : fonti) {
                if (Build.VERSION.SDK_INT >= 31) {
                    android.location.LocationRequest req = new android.location.LocationRequest.Builder(0)
                            .setQuality(android.location.LocationRequest.QUALITY_HIGH_ACCURACY).setDurationMillis(30000).build();
                    lm.getCurrentLocation(prov, req, null, getContext().getMainExecutor(), arrivata::accept);
                } else if (Build.VERSION.SDK_INT >= 30) {
                    lm.getCurrentLocation(prov, null, getContext().getMainExecutor(), arrivata::accept);
                } else {
                    android.location.LocationListener x = new android.location.LocationListener() {
                        @Override public void onLocationChanged(android.location.Location l) { arrivata.accept(l); }
                        @Override public void onStatusChanged(String p, int st, android.os.Bundle b) { }
                        @Override public void onProviderEnabled(String p) { }
                        @Override public void onProviderDisabled(String p) { }
                    };
                    ascolti.add(x);
                    lm.requestSingleUpdate(prov, x, android.os.Looper.getMainLooper());
                }
            }
        } catch (SecurityException e) {
            fatto[0] = true; h.removeCallbacks(scaduto); smetti.run();
            call.reject("Permesso della posizione negato", "PERMESSO");
        }
    }

    /**
     * Affinamento: per un po' (fino a 45 secondi) si ascoltano INSIEME la posizione combinata di Android (quella che usa
     * anche Mappe: GPS + Wi‑Fi + sensori, chiesta alla massima precisione), il GPS e la rete, e si tiene la lettura più precisa.
     * Ogni volta che migliora la si manda subito alla pagina (evento «posizione»), così sullo schermo si vede crescere la
     * precisione; si risponde appena è entro 8 m (o allo scadere con la migliore avuta).
     */
    private void affinaConGps(final PluginCall call, final android.location.LocationManager lm) {
        final java.util.List<String> fonti = new java.util.ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31 && lm.getAllProviders().contains(android.location.LocationManager.FUSED_PROVIDER)
                && lm.isProviderEnabled(android.location.LocationManager.FUSED_PROVIDER)) fonti.add(android.location.LocationManager.FUSED_PROVIDER);
        if (lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)) fonti.add(android.location.LocationManager.GPS_PROVIDER);
        if (lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER)) fonti.add(android.location.LocationManager.NETWORK_PROVIDER);
        if (fonti.isEmpty()) { call.reject("La posizione del telefono è spenta", "SPENTA"); return; }
        final boolean[] fatto = { false };
        final android.location.Location[] migliore = { null };
        final android.os.Handler h = new android.os.Handler(android.os.Looper.getMainLooper());
        final java.util.List<android.location.LocationListener> ascolti = new java.util.ArrayList<>();
        final long[] ultimoMiglioramento = { System.currentTimeMillis() };
        final Runnable fine = () -> {
            if (fatto[0]) return; fatto[0] = true; h.removeCallbacksAndMessages(null);
            for (android.location.LocationListener x : ascolti) { try { lm.removeUpdates(x); } catch (Exception ignorata) { } }
            if (migliore[0] != null) call.resolve(comePosizione(migliore[0])); else call.reject("Nessuna lettura più precisa", "TEMPO");
        };
        final android.location.LocationListener ascolto = new android.location.LocationListener() {
            @Override public void onLocationChanged(android.location.Location l) {
                if (fatto[0] || l == null || !l.hasAccuracy()) return;
                if (migliore[0] != null && l.getAccuracy() >= migliore[0].getAccuracy()) return;
                // un miglioramento piccolo (meno di 2 m) non conta: al chiuso la precisione scende di poco per molto tempo
                if (migliore[0] == null || migliore[0].getAccuracy() - l.getAccuracy() >= 2) ultimoMiglioramento[0] = System.currentTimeMillis();
                migliore[0] = l;
                try { notifyListeners("posizione", comePosizione(l)); } catch (Exception ignorata) { }
                if (l.getAccuracy() <= 8) fine.run();
            }
            @Override public void onStatusChanged(String p, int st, android.os.Bundle b) { }
            @Override public void onProviderEnabled(String p) { }
            @Override public void onProviderDisabled(String p) { }
        };
        ascolti.add(ascolto);
        // ci si ferma quando non migliora più: buona (entro 20 m) e ferma da 4 secondi, oppure ferma da 8 secondi;
        // al chiuso così si finisce in pochi secondi invece di aspettare il limite. Limite massimo: 30 secondi.
        final long inizio = System.currentTimeMillis();
        final Runnable controlla = new Runnable() { @Override public void run() {
            if (fatto[0]) return;
            long fermo = System.currentTimeMillis() - ultimoMiglioramento[0];
            float acc = migliore[0] != null ? migliore[0].getAccuracy() : Float.MAX_VALUE;
            if (System.currentTimeMillis() - inizio >= 30000 || (migliore[0] != null && ((acc <= 20 && fermo >= 4000) || fermo >= 8000))) { fine.run(); return; }
            h.postDelayed(this, 1000);
        } };
        h.postDelayed(controlla, 1000);
        try {
            for (String prov : fonti) {
                if (Build.VERSION.SDK_INT >= 31) {
                    android.location.LocationRequest req = new android.location.LocationRequest.Builder(1000)
                            .setQuality(android.location.LocationRequest.QUALITY_HIGH_ACCURACY).setMinUpdateIntervalMillis(500).build();
                    lm.requestLocationUpdates(prov, req, getContext().getMainExecutor(), ascolto);
                } else {
                    lm.requestLocationUpdates(prov, 1000, 0, ascolto, android.os.Looper.getMainLooper());
                }
            }
        } catch (SecurityException e) { fatto[0] = true; h.removeCallbacksAndMessages(null); try { lm.removeUpdates(ascolto); } catch (Exception ignorata) { } call.reject("Permesso della posizione negato", "PERMESSO"); }
    }

    /** attivaPosizione() — apre le impostazioni della posizione di Android; risponde { attiva } quando si torna nell'app */
    @PluginMethod
    public void attivaPosizione(PluginCall call) {
        try { startActivityForResult(call, new Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS), "tornatoDallaPosizione"); }
        catch (Exception e) { call.reject("Impostazioni non disponibili", "ERRORE", e); }
    }

    @ActivityCallback
    private void tornatoDallaPosizione(PluginCall call, ActivityResult ris) {
        if (call == null) return;
        android.location.LocationManager lm = (android.location.LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        JSObject r = new JSObject(); r.put("attiva", lm != null && lm.isLocationEnabled()); call.resolve(r);
    }

    /** impostazioniApp() — la pagina di DoctorCar nelle impostazioni di Android (per dare un permesso negato per sempre) */
    @PluginMethod
    public void impostazioniApp(PluginCall call) {
        try {
            Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
            startActivityForResult(call, i, "tornatoDalleImpostazioni");
        } catch (Exception e) { call.reject("Impostazioni non disponibili", "ERRORE", e); }
    }

    @ActivityCallback
    private void tornatoDalleImpostazioni(PluginCall call, ActivityResult ris) { if (call != null) call.resolve(); }

    /** indirizzo({ lat, lon }) -> { testo } — l'indirizzo approssimativo del punto, dal servizio di Android (se c'è) */
    @PluginMethod
    public void indirizzo(PluginCall call) {
        Double lat = call.getDouble("lat"), lon = call.getDouble("lon");
        if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) { call.reject("Posizione non valida", "DATI"); return; }
        if (!android.location.Geocoder.isPresent()) { call.reject("Indirizzi non disponibili", "ASSENTE"); return; }
        final android.location.Geocoder g = new android.location.Geocoder(getContext(), java.util.Locale.ITALY);
        if (Build.VERSION.SDK_INT >= 33) {
            g.getFromLocation(lat, lon, 1, new android.location.Geocoder.GeocodeListener() {
                @Override public void onGeocode(java.util.List<android.location.Address> l) { JSObject r = new JSObject(); r.put("testo", testoIndirizzo(l)); call.resolve(r); }
                @Override public void onError(String msg) { call.reject("Indirizzo non trovato", "ERRORE"); }
            });
        } else {
            new Thread(() -> {
                try { JSObject r = new JSObject(); r.put("testo", testoIndirizzo(g.getFromLocation(lat, lon, 1))); call.resolve(r); }
                catch (Exception e) { call.reject("Indirizzo non trovato", "ERRORE"); }
            }).start();
        }
    }

    private static String testoIndirizzo(java.util.List<android.location.Address> l) {
        if (l == null || l.isEmpty()) return "";
        android.location.Address a = l.get(0);
        String via = a.getThoroughfare() != null ? a.getThoroughfare() + (a.getSubThoroughfare() != null ? " " + a.getSubThoroughfare() : "") : "";
        String paese = a.getLocality() != null ? a.getLocality() : a.getSubAdminArea() != null ? a.getSubAdminArea() : "";
        String t = (via + (via.isEmpty() || paese.isEmpty() ? "" : ", ") + paese).trim();
        if (t.isEmpty() && a.getMaxAddressLineIndex() >= 0 && a.getAddressLine(0) != null) t = a.getAddressLine(0);
        return t.length() > 160 ? t.substring(0, 160) : t;
    }

    /** email({ a, oggetto, testo }) — apre l'app di posta con il messaggio già scritto (lo spedisce chi usa l'app) */
    @PluginMethod
    public void email(PluginCall call) {
        try {
            String a = call.getString("a", "");
            Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:"));
            if (a != null && a.matches("[^\\s@]{1,64}@[^\\s@]{1,190}")) i.putExtra(Intent.EXTRA_EMAIL, new String[] { a });
            i.putExtra(Intent.EXTRA_SUBJECT, String.valueOf(call.getString("oggetto", "DoctorCar")));
            String t = String.valueOf(call.getString("testo", ""));
            i.putExtra(Intent.EXTRA_TEXT, t.length() > 20000 ? t.substring(0, 20000) : t);
            getActivity().startActivity(i);
            call.resolve();
        } catch (android.content.ActivityNotFoundException e) {
            call.reject("Nessuna app di posta", "ASSENTE", e);
        }
    }

    /** apriMappa({ lat, lon }) — apre l'app delle mappe sul punto (da lì la navigazione a piedi) */
    @PluginMethod
    public void apriMappa(PluginCall call) {
        Double lat = call.getDouble("lat"), lon = call.getDouble("lon");
        if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) { call.reject("Posizione non valida", "DATI"); return; }
        String p = String.format(java.util.Locale.ROOT, "%.6f,%.6f", lat, lon);
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("geo:" + p + "?q=" + p + "(" + Uri.encode(Testi.t("La mia auto", "My car")) + ")"));
            getActivity().startActivity(i);
            call.resolve();
        } catch (android.content.ActivityNotFoundException e) {
            call.reject("Nessuna app di mappe", "ASSENTE", e);
        }
    }

    // ===================== SCORCIATOIE, WIDGET, AZIONI DELLE NOTIFICHE =====================

    /** scorciatoia() -> { cosa } — la scorciatoia (icona, widget) con cui l'app è stata aperta e non ancora usata */
    @PluginMethod
    public void scorciatoia(PluginCall call) {
        JSObject r = new JSObject();
        r.put("cosa", MainActivity.prelevaScorciatoia());
        call.resolve(r);
    }

    /** aggiornaWidget({ riga1, riga2, intest, righe: [{ t, d, l }] }) — i testi dei widget nella Home di Android */
    @PluginMethod
    public void aggiornaWidget(PluginCall call) {
        try {
            org.json.JSONArray r = call.getArray("righe");
            DoctorCarWidget.aggiorna(getContext(), String.valueOf(call.getString("riga1", "DoctorCar")), String.valueOf(call.getString("riga2", "")),
                    String.valueOf(call.getString("intest", "")), r != null ? r.toString() : "[]");
            call.resolve();
        } catch (Exception e) { call.reject("Widget non aggiornato", "ERRORE", e); }
    }

    /** azioniInCoda() -> { azioni: [...] } — «Fatto oggi» e km scritti dalle notifiche con l'app chiusa; la coda si svuota */
    @PluginMethod
    public void azioniInCoda(PluginCall call) {
        JSObject r = new JSObject();
        r.put("azioni", Coda.preleva(getContext()));
        call.resolve(r);
    }

    /** aggiungiAlCalendario({ titolo, data: 'AAAA-MM-GG', nota }) — apre il calendario del telefono con l'evento già pronto (tutto il giorno) */
    @PluginMethod
    public void aggiungiAlCalendario(PluginCall call) {
        try {
            String d = call.getString("data", "");
            String[] p = d.split("-");
            if (p.length != 3) { call.reject("Data non valida", "DATI"); return; }
            java.util.Calendar k = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"));
            k.clear();
            k.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
            Intent i = new Intent(Intent.ACTION_INSERT, android.provider.CalendarContract.Events.CONTENT_URI);
            i.putExtra(android.provider.CalendarContract.Events.TITLE, call.getString("titolo", "DoctorCar"));
            i.putExtra(android.provider.CalendarContract.Events.DESCRIPTION, call.getString("nota", ""));
            i.putExtra(android.provider.CalendarContract.EXTRA_EVENT_ALL_DAY, true);
            i.putExtra(android.provider.CalendarContract.EXTRA_EVENT_BEGIN_TIME, k.getTimeInMillis());
            i.putExtra(android.provider.CalendarContract.EXTRA_EVENT_END_TIME, k.getTimeInMillis() + 86400000L);
            getActivity().startActivity(i);
            call.resolve();
        } catch (android.content.ActivityNotFoundException e) {
            call.reject("Nessuna app Calendario trovata", "ASSENTE", e);
        } catch (Exception e) {
            call.reject("Calendario non aperto", "ERRORE", e);
        }
    }

    // ===================== PDF E CONDIVISIONE =====================

    private android.webkit.WebView paginaStampa;

    private static String nomeSicuro(String n) {
        String s = n == null ? "" : n.replaceAll("[^A-Za-z0-9 ._-]", "_").trim();
        return s.isEmpty() ? "file" : (s.length() > 80 ? s.substring(0, 80) : s);
    }

    /** creaPdf({ nome, html }) -> { dati: base64 } — un documento in PDF, senza il servizio di stampa di Android (che su molti telefoni manca) */
    @PluginMethod
    public void creaPdf(PluginCall call) {
        final String nome = call.getString("nome", "DoctorCar");
        final String html = call.getString("html");
        if (html == null || html.isEmpty()) { call.reject("Niente da stampare", "DATI"); return; }
        getActivity().runOnUiThread(() -> {
            try {
                final android.view.ViewGroup radice = (android.view.ViewGroup) getActivity().getWindow().getDecorView();
                if (paginaStampa != null) { try { radice.removeView(paginaStampa); } catch (Exception ignorata) { } }
                final android.webkit.WebView wv = new android.webkit.WebView(getActivity());
                paginaStampa = wv;
                try { wv.setAlpha(0f); radice.addView(wv, new android.view.ViewGroup.LayoutParams(2, 2)); } catch (Exception ignorata) { }
                wv.getSettings().setJavaScriptEnabled(false);
                wv.getSettings().setBlockNetworkLoads(true);
                wv.getSettings().setAllowFileAccess(false);
                wv.getSettings().setAllowContentAccess(false);
                final boolean[] fatto = { false };
                wv.setWebViewClient(new android.webkit.WebViewClient() {
                    @Override public void onPageFinished(android.webkit.WebView v, String url) {
                        if (fatto[0]) return;
                        fatto[0] = true;
                        try {
                            File cartella = new File(getContext().getCacheDir(), "aperti");
                            File[] vecchi = cartella.listFiles();
                            if (vecchi != null) for (File f : vecchi) //noinspection ResultOfMethodCallIgnored
                                f.delete();
                            //noinspection ResultOfMethodCallIgnored
                            cartella.mkdirs();
                            final File pdf = new File(cartella, java.util.UUID.randomUUID().toString().substring(0, 8) + ".pdf");
                            android.print.PdfDaPagina.scrivi(v.createPrintDocumentAdapter(nomeSicuro(nome)), pdf, new android.print.PdfDaPagina.Fine() {
                                @Override public void ok() {
                                    try {
                                        byte[] b = java.nio.file.Files.readAllBytes(pdf.toPath());
                                        //noinspection ResultOfMethodCallIgnored
                                        pdf.delete();
                                        JSObject r = new JSObject();
                                        r.put("dati", Base64.encodeToString(b, Base64.NO_WRAP));
                                        call.resolve(r);
                                    } catch (Exception e2) { call.reject("PDF non letto: " + e2.getMessage(), "ERRORE", e2); }
                                    try { radice.removeView(v); } catch (Exception ignorata) { }
                                }
                                @Override public void errore(String motivo) { call.reject("PDF non creato: " + motivo, "ERRORE"); }
                            });
                        } catch (Exception e) { call.reject("PDF non creato: " + e.getMessage(), "ERRORE", e); }
                    }
                });
                wv.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception e) { call.reject("PDF non creato: " + e.getMessage(), "ERRORE", e); }
        });
    }

    /** condividiFile({ nome, mime, dati: base64 }) oppure ({ testo }) — il menu «Condividi» di Android */
    @PluginMethod
    public void condividiFile(PluginCall call) {
        String dati = call.getString("dati"), testo = call.getString("testo");
        try {
            if (dati == null && testo != null) {
                Intent t = new Intent(Intent.ACTION_SEND);
                t.setType("text/plain");
                t.putExtra(Intent.EXTRA_TEXT, testo);
                getActivity().startActivity(Intent.createChooser(t, call.getString("titolo", "DoctorCar")));
                call.resolve();
                return;
            }
            if (dati == null) { call.reject("Mancano i dati", "DATI"); return; }
            String nome = nomeSicuro(call.getString("nome", "file"));
            File cartella = new File(getContext().getCacheDir(), "condivisi");
            File[] vecchi = cartella.listFiles();
            if (vecchi != null) for (File f : vecchi) //noinspection ResultOfMethodCallIgnored
                f.delete();
            //noinspection ResultOfMethodCallIgnored
            cartella.mkdirs();
            File f = new File(cartella, nome);
            try (java.io.FileOutputStream out = new java.io.FileOutputStream(f)) { out.write(Base64.decode(dati, Base64.NO_WRAP)); }
            Uri uri = androidx.core.content.FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(call.getString("mime", "application/octet-stream"));
            i.putExtra(Intent.EXTRA_STREAM, uri);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(i, call.getString("titolo", nome)));
            call.resolve();
        } catch (Exception e) { call.reject("Non condiviso: " + e.getMessage(), "ERRORE", e); }
    }

    // ===================== COPIA AUTOMATICA IN UNA CARTELLA =====================

    private static final String PREF_CARTELLA = "doctorcar_cartella";

    /** scegliCartella() -> { nome } — la persona sceglie una cartella (anche su Drive o su una scheda SD); il permesso resta */
    @PluginMethod
    public void scegliCartella(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        try { startActivityForResult(call, i, "cartellaScelta"); }
        catch (Exception e) { call.reject("Scelta della cartella non disponibile", "ERRORE", e); }
    }

    @ActivityCallback
    private void cartellaScelta(PluginCall call, ActivityResult ris) {
        if (call == null) return;
        if (ris.getResultCode() != Activity.RESULT_OK || ris.getData() == null || ris.getData().getData() == null) { call.reject("Nessuna cartella scelta", "ANNULLATO"); return; }
        try {
            Uri uri = ris.getData().getData();
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContext().getSharedPreferences(PREF_CARTELLA, Context.MODE_PRIVATE).edit().putString("uri", uri.toString()).apply();
            call.resolve(descriviCartella());
        } catch (Exception e) { call.reject("Cartella non utilizzabile: " + e.getMessage(), "ERRORE", e); }
    }

    private JSObject descriviCartella() {
        JSObject r = new JSObject();
        String s = getContext().getSharedPreferences(PREF_CARTELLA, Context.MODE_PRIVATE).getString("uri", null);
        if (s == null) { r.put("nome", ""); return r; }
        Uri uri = Uri.parse(s);
        boolean ok = false;
        for (android.content.UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) if (p.getUri().equals(uri) && p.isWritePermission()) ok = true;
        String nome = "";
        if (ok) {
            try {
                Uri doc = android.provider.DocumentsContract.buildDocumentUriUsingTree(uri, android.provider.DocumentsContract.getTreeDocumentId(uri));
                try (android.database.Cursor c = getContext().getContentResolver().query(doc, new String[] { android.provider.DocumentsContract.Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
                    if (c != null && c.moveToFirst()) nome = c.getString(0);
                }
            } catch (Exception ignorata) { }
            if (nome == null || nome.isEmpty()) nome = Testi.t("Cartella scelta", "Chosen folder");
        }
        r.put("nome", ok ? nome : "");
        return r;
    }

    /** cartellaCopie() -> { nome } — la cartella scelta (vuoto se non c'è o il permesso è stato tolto) */
    @PluginMethod
    public void cartellaCopie(PluginCall call) { call.resolve(descriviCartella()); }

    /** dimenticaCartella() — la copia automatica non scrive più */
    @PluginMethod
    public void dimenticaCartella(PluginCall call) {
        String s = getContext().getSharedPreferences(PREF_CARTELLA, Context.MODE_PRIVATE).getString("uri", null);
        if (s != null) { try { getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(s), Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception ignorata) { } }
        getContext().getSharedPreferences(PREF_CARTELLA, Context.MODE_PRIVATE).edit().remove("uri").apply();
        call.resolve();
    }

    /** scriviInCartella({ nome, dati: base64 }) -> { nome } — scrive (sostituendo) un file nella cartella scelta; tiene solo le ultime 5 copie «DoctorCar-copia-*» */
    @PluginMethod
    public void scriviInCartella(PluginCall call) {
        String s = getContext().getSharedPreferences(PREF_CARTELLA, Context.MODE_PRIVATE).getString("uri", null);
        String dati = call.getString("dati");
        if (s == null || dati == null) { call.reject("Cartella o dati mancanti", "DATI"); return; }
        try {
            Uri albero = Uri.parse(s);
            android.content.ContentResolver cr = getContext().getContentResolver();
            Uri radice = android.provider.DocumentsContract.buildDocumentUriUsingTree(albero, android.provider.DocumentsContract.getTreeDocumentId(albero));
            String nome = nomeSicuro(call.getString("nome", "DoctorCar-copia.dcbackup"));
            Uri figli = android.provider.DocumentsContract.buildChildDocumentsUriUsingTree(albero, android.provider.DocumentsContract.getTreeDocumentId(albero));
            java.util.List<String[]> copie = new java.util.ArrayList<>();   // id, nome
            try (android.database.Cursor c = cr.query(figli, new String[] { android.provider.DocumentsContract.Document.COLUMN_DOCUMENT_ID, android.provider.DocumentsContract.Document.COLUMN_DISPLAY_NAME }, null, null, null)) {
                while (c != null && c.moveToNext()) copie.add(new String[] { c.getString(0), c.getString(1) });
            }
            for (String[] x : copie) if (nome.equals(x[1])) { try { android.provider.DocumentsContract.deleteDocument(cr, android.provider.DocumentsContract.buildDocumentUriUsingTree(albero, x[0])); } catch (Exception ignorata) { } }
            Uri nuovo = android.provider.DocumentsContract.createDocument(cr, radice, "application/octet-stream", nome);
            if (nuovo == null) { call.reject("File non creato nella cartella", "ERRORE"); return; }
            try (OutputStream out = cr.openOutputStream(nuovo, "wt")) { if (out == null) throw new java.io.IOException("scrittura rifiutata"); out.write(Base64.decode(dati, Base64.NO_WRAP)); }
            // solo le ultime 5 copie automatiche
            java.util.List<String[]> mie = new java.util.ArrayList<>();
            for (String[] x : copie) if (x[1] != null && x[1].startsWith("DoctorCar-copia-") && !nome.equals(x[1])) mie.add(x);
            java.util.Collections.sort(mie, (a, b) -> a[1].compareTo(b[1]));
            for (int k = 0; k < mie.size() - 4; k++) { try { android.provider.DocumentsContract.deleteDocument(cr, android.provider.DocumentsContract.buildDocumentUriUsingTree(albero, mie.get(k)[0])); } catch (Exception ignorata) { } }
            JSObject r = new JSObject();
            r.put("nome", nome);
            call.resolve(r);
        } catch (Exception e) { call.reject("Copia non scritta: " + e.getMessage(), "ERRORE", e); }
    }

    // ===================== CANCELLA TUTTO =====================

    /** apriLink({ url }) — apre nel browser solo la pagina per sostenere DoctorCar (Ko-fi) o GitHub; nient'altro */
    @PluginMethod
    public void apriLink(PluginCall call) {
        String u = call.getString("url", "");
        Uri x = Uri.parse(u == null ? "" : u);
        String h = x.getHost() == null ? "" : x.getHost().toLowerCase(java.util.Locale.ROOT);
        if (!"https".equals(x.getScheme()) || !(h.equals("ko-fi.com") || h.equals("github.com"))) { call.reject("Indirizzo non ammesso", "DATI"); return; }
        try { getActivity().startActivity(new Intent(Intent.ACTION_VIEW, x).addCategory(Intent.CATEGORY_BROWSABLE)); call.resolve(); }
        catch (android.content.ActivityNotFoundException e) { call.reject("Nessun browser", "ASSENTE", e); }
    }

    /** barre({ chiaro, colore }) — barra di stato e barra in basso dello stesso colore dell'intestazione della pagina,
     *  con icone scure sul tema chiaro e chiare sul tema scuro (così l'ora si vede sempre) */
    @PluginMethod
    public void barre(PluginCall call) {
        final boolean chiaro = Boolean.TRUE.equals(call.getBoolean("chiaro", false));
        String c = call.getString("colore", "");
        int colore;
        try { colore = android.graphics.Color.parseColor(c != null && c.matches("#[0-9a-fA-F]{6}") ? c : (chiaro ? "#ffffff" : "#1e293b")); }
        catch (Exception e) { colore = chiaro ? 0xffffffff : 0xff1e293b; }
        final int col = colore;
        getActivity().runOnUiThread(() -> {
            android.view.Window w = getActivity().getWindow();
            w.getDecorView().setBackgroundColor(col);
            //noinspection deprecation
            w.setStatusBarColor(col);
            //noinspection deprecation
            w.setNavigationBarColor(col);
            androidx.core.view.WindowInsetsControllerCompat ic = androidx.core.view.WindowCompat.getInsetsController(w, w.getDecorView());
            ic.setAppearanceLightStatusBars(chiaro);
            ic.setAppearanceLightNavigationBars(chiaro);
            call.resolve();
        });
    }

    /** lingua({ inglese }) — la lingua della pagina, per notifiche, widget e fotocamera */
    @PluginMethod
    public void lingua(PluginCall call) {
        boolean en = Boolean.TRUE.equals(call.getBoolean("inglese", false));
        boolean prima = Testi.inglese();
        Testi.imposta(getContext(), en);
        if (prima != en) { try { Promemoria.creaCanale(getContext()); } catch (Exception ignorata) { } }
        call.resolve();
    }

    // ===================== AGGIORNAMENTI DA GITHUB =====================
    // Fuori dal Play Store: la pagina chiede (una volta a settimana o quando tocchi «Controlla») se c'è una versione nuova.
    // Il lavoro di rete è tutto qui, non nella pagina (che resta senza internet). Vedi Aggiornamento.java per i controlli.
    private Aggiornamento.Info ultimaTrovata;
    private File apkPronto;

    /** controllaAggiornamento() → { installata, nuova, versione?, novita?, dimensione? } */
    @PluginMethod
    public void controllaAggiornamento(PluginCall call) {
        new Thread(() -> {
            try {
                Context c = getContext();
                long mia = Aggiornamento.versioneInstallata(c);
                Aggiornamento.Info x = Aggiornamento.ultima(c);
                JSObject r = new JSObject();
                r.put("installata", mia);
                boolean nuova = x != null && x.versionCode > mia;
                r.put("nuova", nuova);
                if (nuova) { ultimaTrovata = x; r.put("versione", x.versione); r.put("novita", x.novita); r.put("dimensione", x.dimensione); }
                else Aggiornamento.pulisci(c);
                call.resolve(r);
            } catch (Exception e) { call.reject(messaggio(e, "Non riesco a controllare: sei collegato a internet?")); }
        }, "aggiornamento").start();
    }

    /** scaricaAggiornamento() → scarica, controlla e apre l'installazione di Android (che chiede la conferma). Avanzamento: evento «aggiornamento» { percento } */
    @PluginMethod
    public void scaricaAggiornamento(PluginCall call) {
        final Aggiornamento.Info x = ultimaTrovata;
        if (x == null) { call.reject("Prima controlla se c'è una versione nuova"); return; }
        new Thread(() -> {
            try {
                apkPronto = Aggiornamento.scaricaEVerifica(getContext(), x, p -> { JSObject e = new JSObject(); e.put("percento", p); notifyListeners("aggiornamento", e); });
                getActivity().runOnUiThread(() -> installaOPermesso(call));
            } catch (SecurityException e) { call.reject(messaggio(e, "File non valido"), "FIRMA"); }
            catch (Exception e) { call.reject(messaggio(e, "Download non riuscito: riprova più tardi.")); }
        }, "aggiornamento").start();
    }

    private void installaOPermesso(PluginCall call) {
        if (!getContext().getPackageManager().canRequestPackageInstalls()) {
            // la prima volta Android chiede di permettere a DoctorCar di installare app: si torna qui da soli
            Intent i = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            startActivityForResult(call, i, "dopoPermessoInstallazione");
            return;
        }
        installa(call);
    }

    @ActivityCallback
    private void dopoPermessoInstallazione(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (!getContext().getPackageManager().canRequestPackageInstalls()) { JSObject r = new JSObject(); r.put("permesso", false); call.resolve(r); return; }
        installa(call);
    }

    private void installa(PluginCall call) {
        File f = apkPronto;
        if (f == null || !f.isFile()) { call.reject("Il file non c'è più: tocca di nuovo Aggiorna"); return; }
        try {
            Uri u = androidx.core.content.FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(u, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            JSObject r = new JSObject(); r.put("permesso", true); r.put("avviata", true); call.resolve(r);
        } catch (Exception e) { call.reject(messaggio(e, "Non riesco ad aprire l'installazione")); }
    }

    private static String messaggio(Exception e, String predefinito) {
        String m = e.getMessage();
        return m == null || m.isEmpty() || m.length() > 160 || e instanceof java.net.UnknownHostException || e instanceof java.net.SocketTimeoutException ? predefinito : m;
    }

    /** cancellaTutto() — chiavi del Keystore, sincronizzazione e tutti i dati dell'app. Android poi chiude l'app. */
    @PluginMethod
    public void cancellaTutto(PluginCall call) {
        // anche qui, non solo nella pagina: se il telefono ha un blocco, si cancella solo se impronta o PIN sono stati confermati nell'ultimo minuto
        if (puoVerificare()) {
            long da = android.os.SystemClock.elapsedRealtime() - ultimaIdentita;
            if (ultimaIdentita == 0 || da > 60_000) { call.reject("Conferma l'identità prima di cancellare", "IDENTITA"); return; }
            ultimaIdentita = 0;
        }
        Context c = getContext();
        try { Promemoria.annulla(c); } catch (Exception ignored) { }
        try { pairwood.sdk.PairWood.cancellaTuttoSenzaAvviare(c, c.getPackageName()); } catch (Exception ignored) { }
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            for (String alias : java.util.Collections.list(ks.aliases())) { try { ks.deleteEntry(alias); } catch (Exception ignored) { } }
        } catch (Exception ignored) { }
        cancellaCartella(c.getCacheDir());
        call.resolve();
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            ActivityManager am = (ActivityManager) c.getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null || !am.clearApplicationUserData()) {
                cancellaCartella(c.getFilesDir());
                Activity a = getActivity();
                if (a != null) a.finishAndRemoveTask();
            }
        }, 400);
    }

    private static void cancellaCartella(File f) {
        if (f == null || !f.exists()) return;
        File[] figli = f.listFiles();
        if (figli != null) for (File x : figli) {
            if (x.isDirectory()) cancellaCartella(x);
            //noinspection ResultOfMethodCallIgnored
            x.delete();
        }
    }
}
