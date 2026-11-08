package com.lostanarchygames.rocketrush;

import android.app.Activity;

import androidx.annotation.NonNull;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.RequestConfiguration;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/**
 * Anuncios de AdMob con el formulario de consentimiento de Google (UMP), obligatorio en el Espacio Económico Europeo.
 * Primero se pide el consentimiento; solo después se inicia AdMob y se cargan los anuncios.
 * El juego recibe el resultado del anuncio con premio en window.onChromaReward(true|false)
 * y el final del intersticial en window.onChromaInterstitial().
 */
class Ads {
    private final Consumer<String> js;
    private final ConsentInformation consent;
    private final AtomicBoolean started = new AtomicBoolean(false);
    private RewardedAd rewarded;
    private InterstitialAd inter;
    private boolean loadingR = false, loadingI = false;
    /** true mientras se ve un anuncio a pantalla completa: MainActivity no debe congelar los WebView (pauseTimers es global y paraba el anuncio). */
    private volatile boolean showing = false;

    boolean isShowing() { return showing; }
    private int age = 0;
    private final String idRewarded, idInter;

    Ads(Activity a, Consumer<String> js) {
        this.js = js;
        consent = UserMessagingPlatform.getConsentInformation(a);
        idRewarded = a.getString(R.string.admob_rewarded);
        idInter = a.getString(R.string.admob_interstitial);
    }

    void init(Activity a, int age) {
        this.age = age;
        ConsentRequestParameters params = new ConsentRequestParameters.Builder()
                .setTagForUnderAgeOfConsent(age > 0 && age < 16)
                .build();
        consent.requestConsentInfoUpdate(a, params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(a, err -> start(a)),
                err -> start(a));
        if (consent.canRequestAds()) start(a);   // consentimiento de una sesión anterior
    }

    private void start(Activity a) {
        if (!consent.canRequestAds() || started.getAndSet(true)) return;
        RequestConfiguration.Builder rc = MobileAds.getRequestConfiguration().toBuilder();
        // menores de 13: tratamiento para niños (sin anuncios personalizados, solo para todos los públicos);
        // de 13 a 15: menor de la edad de consentimiento de la UE (sin anuncios personalizados)
        if (age > 0 && age < 13) rc.setTagForChildDirectedTreatment(RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE);
        if (age > 0 && age < 16) rc.setTagForUnderAgeOfConsent(RequestConfiguration.TAG_FOR_UNDER_AGE_OF_CONSENT_TRUE);
        rc.setMaxAdContentRating(age > 0 && age < 13 ? RequestConfiguration.MAX_AD_CONTENT_RATING_G : RequestConfiguration.MAX_AD_CONTENT_RATING_T);
        MobileAds.setRequestConfiguration(rc.build());
        new Thread(() -> MobileAds.initialize(a, s -> a.runOnUiThread(() -> { loadRewarded(a); loadInter(a); }))).start();
    }

    private void loadRewarded(Activity a) {
        if (rewarded != null || loadingR || !started.get()) return;
        loadingR = true;
        RewardedAd.load(a, idRewarded, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull RewardedAd ad) { rewarded = ad; loadingR = false; }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { rewarded = null; loadingR = false; }
        });
    }

    private void loadInter(Activity a) {
        if (inter != null || loadingI || !started.get()) return;
        loadingI = true;
        InterstitialAd.load(a, idInter, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull InterstitialAd ad) { inter = ad; loadingI = false; }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError e) { inter = null; loadingI = false; }
        });
    }

    void showRewarded(Activity a) {
        if (rewarded == null) { js.accept("window.onChromaReward && window.onChromaReward(false, 'noad')"); loadRewarded(a); return; }
        final boolean[] earned = {false};
        RewardedAd ad = rewarded; rewarded = null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() { showing = false; js.accept("window.onChromaReward && window.onChromaReward(" + earned[0] + ")"); loadRewarded(a); }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) { showing = false; js.accept("window.onChromaReward && window.onChromaReward(false, 'noad')"); loadRewarded(a); }
        });
        showing = true;
        ad.show(a, item -> earned[0] = true);
    }

    void showInterstitial(Activity a) {
        if (inter == null) { js.accept("window.onChromaInterstitial && window.onChromaInterstitial()"); loadInter(a); return; }
        InterstitialAd ad = inter; inter = null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdDismissedFullScreenContent() { showing = false; js.accept("window.onChromaInterstitial && window.onChromaInterstitial()"); loadInter(a); }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) { showing = false; js.accept("window.onChromaInterstitial && window.onChromaInterstitial()"); loadInter(a); }
        });
        showing = true;
        ad.show(a);
    }

    boolean privacyRequired() {
        return consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    void privacyOptions(Activity a) { UserMessagingPlatform.showPrivacyOptionsForm(a, err -> { }); }
}
