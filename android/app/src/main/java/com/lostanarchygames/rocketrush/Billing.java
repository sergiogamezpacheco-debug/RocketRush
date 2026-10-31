package com.lostanarchygames.rocketrush;

import android.app.Activity;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Compras dentro del juego con Google Play Billing. El juego (JavaScript) recibe los avisos en window.onBilling(obj):
 *   {type:'products', items:[{id, price}]}   precios en la moneda del jugador
 *   {type:'purchase', id, token}            compra pagada: el juego da el premio y llama a billingFinish(token, consumible)
 *   {type:'owned', ids:[…]}                 compras de una sola vez que ya tiene (restaurar)
 *   {type:'error', id, code}                cancelada o fallida
 * Una compra que no se confirma en 3 días la devuelve Google: por eso se confirma justo después de darla.
 */
class Billing {
    private final BillingClient client;
    private final Consumer<String> js;
    private final Map<String, ProductDetails> details = new HashMap<>();
    private boolean ready = false;

    Billing(Activity a, Consumer<String> js) {
        this.js = js;
        client = BillingClient.newBuilder(a.getApplicationContext())
                .setListener((r, purchases) -> {
                    if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) for (Purchase p : purchases) deliver(p);
                    else if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) send("{\"type\":\"error\",\"code\":" + r.getResponseCode() + "}");
                })
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        connect(null);
    }

    private void connect(Runnable then) {
        if (ready) { if (then != null) then.run(); return; }
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult r) {
                ready = r.getResponseCode() == BillingClient.BillingResponseCode.OK;
                if (ready && then != null) then.run();
                if (ready) restore();
            }
            @Override public void onBillingServiceDisconnected() { ready = false; }
        });
    }

    private void send(String json) { js.accept("window.onBilling && window.onBilling(" + json + ")"); }

    void query(String idsJson) {
        connect(() -> {
            try {
                JSONArray ids = new JSONArray(idsJson);
                List<QueryProductDetailsParams.Product> list = new ArrayList<>();
                for (int i = 0; i < ids.length(); i++) list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(ids.getString(i)).setProductType(BillingClient.ProductType.INAPP).build());
                client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (r, res) -> {
                    JSONArray items = new JSONArray();
                    for (ProductDetails d : res.getProductDetailsList()) {
                        details.put(d.getProductId(), d);
                        ProductDetails.OneTimePurchaseOfferDetails o = d.getOneTimePurchaseOfferDetails();
                        try { items.put(new JSONObject().put("id", d.getProductId()).put("price", o != null ? o.getFormattedPrice() : "")); } catch (Exception e) { /* nada */ }
                    }
                    send("{\"type\":\"products\",\"items\":" + items + "}");
                });
            } catch (Exception e) { send("{\"type\":\"error\",\"code\":-1}"); }
        });
    }

    void buy(Activity a, String id) {
        connect(() -> {
            ProductDetails d = details.get(id);
            if (d == null) { send("{\"type\":\"error\",\"id\":" + MainActivity.q(id) + ",\"code\":-2}"); return; }
            List<BillingFlowParams.ProductDetailsParams> p = new ArrayList<>();
            p.add(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(d).build());
            a.runOnUiThread(() -> client.launchBillingFlow(a, BillingFlowParams.newBuilder().setProductDetailsParamsList(p).build()));
        });
    }

    private void deliver(Purchase p) {
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;   // pendiente: llegará cuando se pague
        if (p.isAcknowledged()) return;                                          // ya entregada y confirmada
        for (String id : p.getProducts()) send("{\"type\":\"purchase\",\"id\":" + MainActivity.q(id) + ",\"token\":" + MainActivity.q(p.getPurchaseToken()) + "}");
    }

    /** El juego ya ha dado el premio: se consume (se puede volver a comprar) o se confirma (compras de una sola vez). */
    void finish(String token, boolean consume) {
        connect(() -> {
            if (consume) client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build(), (r, t) -> { });
            else client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(), r -> { });
        });
    }

    /** Compras sin entregar (se cerró el juego a medias) y compras de una sola vez que ya tiene. */
    void restore() {
        if (!ready) return;
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (r, list) -> {
            JSONArray owned = new JSONArray();
            for (Purchase p : list) {
                if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                if (!p.isAcknowledged()) deliver(p);
                else for (String id : p.getProducts()) owned.put(id);
            }
            send("{\"type\":\"owned\",\"ids\":" + owned + "}");
        });
    }

    void end() { try { client.endConnection(); } catch (Exception e) { /* nada */ } }
}
