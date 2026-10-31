package com.lostanarchygames.rocketrush;

import android.app.Activity;
import android.os.CancellationSignal;

import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONObject;

import java.util.function.Consumer;

/**
 * Entrar con Google (Credential Manager). El juego llama a googleSignIn(idDeClienteWeb) y recibe en
 * window.onGoogleSignIn({ok, idToken, email, name}) o {ok:false, error}. Con ese idToken, social.js entra en Firebase
 * (accounts:signInWithIdp) y enlaza la cuenta anónima a la de Google, así el progreso se puede recuperar en otro móvil.
 */
class GoogleLogin {
    private final CredentialManager cm;
    private final Consumer<String> js;

    GoogleLogin(Activity a, Consumer<String> js) {
        this.cm = CredentialManager.create(a);
        this.js = js;
    }

    private void send(JSONObject o) { js.accept("window.onGoogleSignIn && window.onGoogleSignIn(" + o + ")"); }

    void signIn(Activity a, String webClientId) {
        GetSignInWithGoogleOption opt = new GetSignInWithGoogleOption.Builder(webClientId).build();
        GetCredentialRequest req = new GetCredentialRequest.Builder().addCredentialOption(opt).build();
        cm.getCredentialAsync(a, req, new CancellationSignal(), ContextCompat.getMainExecutor(a),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override public void onResult(GetCredentialResponse r) {
                    try {
                        Credential c = r.getCredential();
                        if (c instanceof CustomCredential && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                            GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(((CustomCredential) c).getData());
                            send(new JSONObject().put("ok", true).put("idToken", g.getIdToken()).put("email", g.getId())
                                .put("name", g.getDisplayName() == null ? "" : g.getDisplayName()));
                            return;
                        }
                        send(new JSONObject().put("ok", false).put("error", "TYPE"));
                    } catch (Exception e) { try { send(new JSONObject().put("ok", false).put("error", "PARSE")); } catch (Exception x) { /* nada */ } }
                }
                @Override public void onError(GetCredentialException e) {
                    try { send(new JSONObject().put("ok", false).put("error", e instanceof GetCredentialCancellationException ? "CANCEL" : e.getType())); } catch (Exception x) { /* nada */ }
                }
            });
    }

    void signOut(Activity a) {
        cm.clearCredentialStateAsync(new ClearCredentialStateRequest(), new CancellationSignal(), ContextCompat.getMainExecutor(a),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override public void onResult(Void v) { }
                @Override public void onError(ClearCredentialException e) { }
            });
    }
}
