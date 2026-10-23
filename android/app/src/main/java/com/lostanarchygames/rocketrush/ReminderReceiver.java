package com.lostanarchygames.rocketrush;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Recordatorio local de la racha diaria. No necesita conexión ni servidor. */
public class ReminderReceiver extends BroadcastReceiver {

    private static final String CHANNEL = "racha";
    private static final int REQ = 1;

    /** Programa (o sustituye) el aviso para el instante indicado, en milisegundos. */
    static void schedule(Context c, long atMs, String title, String text) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.set(AlarmManager.RTC_WAKEUP, atMs, pending(c, title, text));
    }

    static void cancel(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(c, null, null));
    }

    private static PendingIntent pending(Context c, String title, String text) {
        Intent i = new Intent(c, ReminderReceiver.class);
        if (title != null) {
            i.putExtra("title", title);
            i.putExtra("text", text);
        }
        return PendingIntent.getBroadcast(c, REQ, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onReceive(Context ctx, Intent in) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        String title = in.getStringExtra("title");
        String text = in.getStringExtra("text");
        if (title == null) title = "Tu racha diaria te espera";
        if (text == null) text = "Entra hoy y recoge tu premio.";

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Racha diaria", NotificationManager.IMPORTANCE_DEFAULT));
            b = new Notification.Builder(ctx, CHANNEL);
        } else {
            b = new Notification.Builder(ctx);
        }
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        b.setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(text)
                .setAutoCancel(true)
                .setContentIntent(pi);
        try {
            nm.notify(REQ, b.build());
        } catch (SecurityException e) {
            // sin permiso de notificaciones: no se muestra nada
        }
    }
}
