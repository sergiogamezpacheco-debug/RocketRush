package com.lostanarchygames.rocketrush;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * Aviso automático de actualización de Google Play (In-App Updates).
 * Al abrir el juego, si en Google Play hay una versión más nueva, sale la pantalla de Google «Actualización disponible»
 * con el botón «Actualizar»: se descarga e instala sin salir del juego y después se vuelve a abrir solo.
 * Si el jugador la cierra, no se le vuelve a pedir hasta la próxima vez que abra el juego.
 * Solo funciona si el juego se instaló desde Google Play (también en la prueba cerrada); con una APK suelta no hace nada.
 * El aviso del panel de administración (versión mínima, obligatoria o no) sigue funcionando aparte, también en iPhone.
 */
class Updates {
    private final AppUpdateManager manager;
    private final ActivityResultLauncher<IntentSenderRequest> launcher;
    private boolean askedThisLaunch = false;

    /** Hay que crearlo en onCreate (antes de que la actividad arranque) por registerForActivityResult. */
    Updates(ComponentActivity a) {
        manager = AppUpdateManagerFactory.create(a);
        launcher = a.registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), r -> { });
    }

    /** Al abrir el juego: si hay versión nueva, pide actualizar (una vez por apertura). */
    void check() {
        if (askedThisLaunch) return;
        manager.getAppUpdateInfo().addOnSuccessListener(info -> {
            if (askedThisLaunch) return;
            if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                askedThisLaunch = true;
                start(info);
            }
        });
    }

    /** Al volver al juego: si una actualización ya empezada se quedó a medias, se continúa (lo pide Google). */
    void resume() {
        manager.getAppUpdateInfo().addOnSuccessListener(info -> {
            if (info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) start(info);
        });
    }

    private void start(com.google.android.play.core.appupdate.AppUpdateInfo info) {
        try {
            manager.startUpdateFlowForResult(info, launcher, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build());
        } catch (Exception ignored) { }
    }
}
