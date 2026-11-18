package bo.autodamage.cliente;
import android.app.*;
import android.content.*;
import android.os.*;
import android.webkit.CookieManager;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
public class NoticeService extends Service {
  public static volatile boolean running=false;
  private ScheduledExecutorService executor;
  private String server,lastCookie="",cursor=null;
  private static final String STATUS="autodamage-recepcion", EVENTS="autodamage-casos";
  private NotificationManager manager;
  public IBinder onBind(Intent intent){
    return null;
  } public int onStartCommand(Intent intent,int flags,int startId){
    if(intent==null || intent.getStringExtra("server")==null){
      stopSelf();
      return START_NOT_STICKY;
    } server=intent.getStringExtra("server");
    manager=getSystemService(NotificationManager.class);
    manager.createNotificationChannel(new NotificationChannel(STATUS,"Recepción por Wi-Fi",NotificationManager.IMPORTANCE_LOW));
    manager.createNotificationChannel(new NotificationChannel(EVENTS,"Cambios en mis siniestros",NotificationManager.IMPORTANCE_DEFAULT));
    Intent stop=new Intent(this,NoticeService.class).setAction("STOP");
    if("STOP".equals(intent.getAction())){
      stopSelf();
      return START_NOT_STICKY;
    } PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    PendingIntent end=PendingIntent.getService(this,1,stop.putExtra("server",server),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    Notification notification=new Notification.Builder(this,STATUS).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("AutoDamage: avisos activados").setContentText("Requiere el servidor encendido y la misma Wi-Fi.").setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,"Detener",end).build()).build();
    startForeground(1,notification);
    running=true;
    if(executor==null){
      executor=Executors.newSingleThreadScheduledExecutor();
      executor.scheduleWithFixedDelay(this::poll,0,10,TimeUnit.SECONDS);
    } return START_NOT_STICKY;
  } private void poll(){
    HttpURLConnection connection=null;
    try{
      String cookie=CookieManager.getInstance().getCookie(server);
      if(cookie==null || !cookie.contains("autodamage_session=")){
        stopSelf();
        return;
      } if(!cookie.equals(lastCookie)){
        cursor=null;
        lastCookie=cookie;
      } connection=(HttpURLConnection)new URL(server+"/api/notificaciones"+(cursor==null?"":"?despues="+cursor)).openConnection();
      connection.setInstanceFollowRedirects(false);
      connection.setConnectTimeout(5000);
      connection.setReadTimeout(8000);
      connection.setRequestProperty("Cookie",cookie);
      int status=connection.getResponseCode();
      if(status==401 || status==403){
        stopSelf();
        return;
      } if(status!=200)return;
      ByteArrayOutputStream bytes=new ByteArrayOutputStream();
      try(InputStream stream=connection.getInputStream()){
        byte[] buffer=new byte[4096];
        int n;
        while((n=stream.read(buffer))!=-1){
          if(bytes.size()+n>262144)throw new IOException();
          bytes.write(buffer,0,n);
        }
      } JSONObject response=new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
      if(!response.optBoolean("disponible"))return;
      if(!running || !cookie.equals(CookieManager.getInstance().getCookie(server))) { cursor=null; return; }
      JSONArray rows=response.getJSONArray("notificaciones");
      if(cursor==null){
        cursor=rows.length()==0?"0":rows.getJSONObject(0).getString("id");
        return;
      } for(int i=0;i<rows.length();i++){
        JSONObject row=rows.getJSONObject(i);
        String id=row.getString("id"),caseId=row.getString("siniestroId");
        if(!id.matches("[0-9]{1,18}") || !caseId.matches("[a-fA-F0-9-]{36}"))continue;
        Intent target=new Intent(this,MainActivity.class).putExtra("case",caseId).setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent action=PendingIntent.getActivity(this,id.hashCode(),target,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notice=new Notification.Builder(this,EVENTS).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(row.getString("titulo")).setContentText("Abre el expediente para consultar los detalles.").setContentIntent(action).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).build();
        manager.notify("case",id.hashCode(),notice);
        cursor=id;
      }
    } catch(Exception ignored){
      /* Reintentar al recuperar la Wi-Fi; conservar el cursor. */
    } finally{
      if(connection!=null)connection.disconnect();
    }
  } @Override public void onTimeout(int startId,int type){
    stopSelf();
  } @Override public void onDestroy(){
    running=false;
    if(executor!=null)executor.shutdownNow();
    stopForeground(STOP_FOREGROUND_REMOVE);
    super.onDestroy();
  }
}
