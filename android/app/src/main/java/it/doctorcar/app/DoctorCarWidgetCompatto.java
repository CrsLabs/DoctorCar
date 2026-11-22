package it.doctorcar.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** La versione compatta del widget (una riga): prossima scadenza e tre tasti con le icone. */
public class DoctorCarWidgetCompatto extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, DoctorCarWidget.vista(c, R.layout.widget_doctorcar_compatto));
    }
}
