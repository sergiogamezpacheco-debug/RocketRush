package com.lostanarchygames.rocketrush;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.ComponentActivity;
import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

/**
 * Envoltorio nativo: carga el juego desde los recursos de la app, sin conexión.
 * El juego se sirve como https://appassets.androidplatform.net/assets/index.html (sale de la propia APK, no de internet):
 * así el WebView lo trata como una página segura y puede hablar con Firebase y guardar la sesión.
 * Android 15+ dibuja de borde a borde: las zonas de la muesca y de las barras se pasan al juego como variables CSS
 * (--sat, --sar, --sab, --sal) y el juego deja ese margen.
 */
public class MainActivity extends ComponentActivity {

    private WebView web;
    private Billing billing;
    private Ads ads;
    private GoogleLogin google;
    private Insets lastInsets = Insets.NONE;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30 ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(0xFF1D1440);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        // sin caché: cada versión nueva de la APK carga siempre el juego recién instalado
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.clearCache(true);
        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }
            @Override
            public void onPageFinished(WebView view, String url) { pushInsets(); }
            // los enlaces de fuera del juego (privacidad, soporte, Play) se abren en el navegador, nunca dentro del juego
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                android.net.Uri u = request.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* sin navegador */ }
                return true;
            }
            // en móviles con poca memoria el sistema puede cerrar el motor de la página (WebGL): sin esto se cerraría
            // la app entera; así se vuelve a abrir el juego (el progreso está guardado). Solo existe desde Android 8.
            @android.annotation.TargetApi(26)
            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                if (web == view) { setContentView(new android.view.View(MainActivity.this)); web.destroy(); web = null; }
                recreate();
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "ChromaAndroid");
        setContentView(web);

        // muesca y barras del sistema: el juego recibe sus medidas en píxeles CSS
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, wi) -> {
            lastInsets = wi.getInsets(WindowInsetsCompat.Type.displayCutout());
            pushInsets();
            return WindowInsetsCompat.CONSUMED;
        });
        hideSystemUi();

        // gesto atrás (también el predictivo de Android 14+): primero cierra lo que haya abierto en el juego
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web == null) { finish(); return; }
                web.evaluateJavascript("(window.ChromaBack && window.ChromaBack()) ? 'si' : 'no'", value -> {
                    if (value == null || !value.contains("si")) moveTaskToBack(true);
                });
            }
        });

        billing = new Billing(this, this::js);
        ads = new Ads(this, this::js);
        google = new GoogleLogin(this, this::js);
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    /** Ejecuta código en el juego (siempre en el hilo principal). */
    void js(String code) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }
    static String q(String s) { return JSONObject.quote(s == null ? "" : s); }

    private void pushInsets() {
        if (web == null) return;
        float d = getResources().getDisplayMetrics().density;
        js(String.format(java.util.Locale.US, "window.ChromaInsets && window.ChromaInsets(%.1f,%.1f,%.1f,%.1f)",
                lastInsets.top / d, lastInsets.right / d, lastInsets.bottom / d, lastInsets.left / d));
    }

    /** Funciones que el juego puede llamar desde JavaScript. */
    private class Bridge {
        @JavascriptInterface
        public void vibrate(long ms) {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || ms <= 0) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.min(ms, 300), VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(Math.min(ms, 300));
        }

        /** Aviso de la racha diaria: el juego pasa la hora (ms desde 1970, como texto) y el mensaje. */
        @JavascriptInterface
        public void scheduleReminder(String atMs, String title, String text) {
            try { ReminderReceiver.schedule(MainActivity.this, Long.parseLong(atMs), title, text); } catch (NumberFormatException e) { /* hora no válida */ }
        }

        @JavascriptInterface
        public void cancelReminder() { ReminderReceiver.cancel(MainActivity.this); }

        /** Otros avisos con nombre (p. ej. «cofre»: el cofre gratis ya está listo). */
        @JavascriptInterface
        public void scheduleNotice(String name, String atMs, String title, String text) {
            try { ReminderReceiver.schedule(MainActivity.this, ReminderReceiver.idOf(name), Long.parseLong(atMs), title, text); } catch (NumberFormatException e) { /* hora no válida */ }
        }

        @JavascriptInterface
        public void cancelNotice(String name) { ReminderReceiver.cancel(MainActivity.this, ReminderReceiver.idOf(name)); }

        /** Comparte un texto (invitación con el código de amigo) con las apps del móvil. */
        @JavascriptInterface
        public void share(String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(i, "Rocket Rush"));
            });
        }

        /** Abre un enlace fuera del juego (ficha de Play, privacidad, correo de soporte). Solo https, market y mailto. */
        @JavascriptInterface
        public void openUrl(String url) {
            if (url == null || !(url.startsWith("https://") || url.startsWith("market://") || url.startsWith("mailto:"))) return;
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(url.startsWith("mailto:") ? Intent.ACTION_SENDTO : Intent.ACTION_VIEW, android.net.Uri.parse(url));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(i);
                } catch (Exception e) { /* sin navegador, correo ni Play */ }
            });
        }

        /** Android 13+ pide permiso para notificar. Se pregunta solo cuando el jugador toca "Avisarme". */
        @JavascriptInterface
        public void askNotifications() {
            if (Build.VERSION.SDK_INT < 33) return;
            runOnUiThread(() -> {
                if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 7);
                }
            });
        }

        @JavascriptInterface
        public String version() { try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; } }

        // ---------- compras (Google Play Billing) ----------
        @JavascriptInterface public void billingQuery(String idsJson) { billing.query(idsJson); }
        @JavascriptInterface public void billingBuy(String id) { runOnUiThread(() -> billing.buy(MainActivity.this, id)); }
        @JavascriptInterface public void billingFinish(String token, boolean consume) { billing.finish(token, consume); }
        @JavascriptInterface public void billingRestore() { billing.restore(); }

        // ---------- entrar con Google ----------
        @JavascriptInterface public void googleSignIn(String webClientId) { runOnUiThread(() -> google.signIn(MainActivity.this, webClientId)); }
        @JavascriptInterface public void googleSignOut() { runOnUiThread(() -> google.signOut(MainActivity.this)); }

        // ---------- anuncios (AdMob) y consentimiento (UMP) ----------
        /** age: edad del jugador (0 = no la sabemos). Menores de 16: anuncios no personalizados. */
        @JavascriptInterface public void adsInit(int age) { runOnUiThread(() -> ads.init(MainActivity.this, age)); }
        @JavascriptInterface public void showRewarded() { runOnUiThread(() -> ads.showRewarded(MainActivity.this)); }
        @JavascriptInterface public void showInterstitial() { runOnUiThread(() -> ads.showInterstitial(MainActivity.this)); }
        @JavascriptInterface public boolean adsPrivacyRequired() { return ads.privacyRequired(); }
        @JavascriptInterface public void adsPrivacyOptions() { runOnUiThread(() -> ads.privacyOptions(MainActivity.this)); }
    }

    private void hideSystemUi() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.ChromaPause && window.ChromaPause()", null);
            web.onPause();
            web.pauseTimers();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.resumeTimers();
            web.evaluateJavascript("window.ChromaResume && window.ChromaResume()", null);
        }
        if (billing != null) billing.restore();   // compras pendientes que se completaron fuera (pago en efectivo, etc.)
    }

    @Override
    protected void onDestroy() {
        if (billing != null) billing.end();
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
