package bo.autodamage.cliente;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.location.*;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.*;
import android.widget.*;
import org.json.JSONObject;
import java.io.*;
public class MainActivity extends Activity {
  private WebView web;
  private String origin="",pendingCamera,pendingLocation;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private LocationListener locationListener;
  private Runnable locationTimeout;
  private Button notices;
  private boolean receiving=false;
  private boolean trusted() {
    return web!=null && sameOrigin(web.getUrl());
  } private boolean sameOrigin(String url) {
    if(url==null || origin.isEmpty()) return false;
    Uri a=Uri.parse(origin), b=Uri.parse(url);
    return a.getScheme().equals(b.getScheme()) && a.getHost().equals(b.getHost()) && a.getPort()==b.getPort();
  } private boolean allowed(String url) {
    if(!sameOrigin(url)) return false;
    String path=Uri.parse(url).getPath();
    return path.equals("/") || path.equals("/login") || path.equals("/registro") || path.equals("/asegurado") || path.startsWith("/asegurado/");
  } @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setOnApplyWindowInsetsListener((view,insets) -> { android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout()); int bottom=Math.max(bars.bottom,insets.getInsets(android.view.WindowInsets.Type.ime()).bottom); view.setPadding(bars.left,bars.top,bars.right,bottom); return insets; });
    LinearLayout bar=new LinearLayout(this);
    Button server=new Button(this);
    server.setText("Servidor");
    server.setOnClickListener(v->configure());
    server.setTextSize(12); server.setAllCaps(false); bar.addView(server,new LinearLayout.LayoutParams(0,-2,1));
    notices=new Button(this);
    notices.setText("Activar avisos");
    notices.setOnClickListener(v->toggleNotices());
    notices.setTextSize(12); notices.setAllCaps(false); bar.addView(notices,new LinearLayout.LayoutParams(0,-2,1));
    Button reload=new Button(this);
    reload.setText("Actualizar");
    reload.setOnClickListener(v->{
      if(trusted())web.reload();
    } );
    reload.setTextSize(12); reload.setAllCaps(false); bar.addView(reload,new LinearLayout.LayoutParams(0,-2,1));
    root.addView(bar);
    web=new WebView(this);
    root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
    setContentView(root);
    if(Build.VERSION.SDK_INT>=33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, () -> { if(web.canGoBack()) web.goBack(); else finish(); });
    WebSettings settings=web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setSafeBrowsingEnabled(true);
    settings.setUserAgentString(settings.getUserAgentString()+" AutoDamageAndroid/1.0");
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
    web.addJavascriptInterface(new NativeBridge(),"AutoDamageAndroid");
    web.setWebViewClient(new WebViewClient(){
      public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
        return !allowed(request.getUrl().toString());
      } public void onPageStarted(WebView view,String url,Bitmap icon){
        if(!allowed(url)){
          view.stopLoading();view.loadUrl(origin+"/login");Toast.makeText(MainActivity.this,"Esta app es exclusiva del asegurado.",Toast.LENGTH_LONG).show();
        }
      } public void onPageFinished(WebView view,String url){
        CookieManager.getInstance().flush();
      } public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
        if(request.isForMainFrame())Toast.makeText(MainActivity.this,"No se pudo conectar. Revisa el servidor y la misma red Wi-Fi.",Toast.LENGTH_LONG).show();
      }
    } );
    origin=getPreferences(0).getString("server","");
    if(origin.isEmpty())configure();
    else openCase(getIntent());
  } private void openCase(Intent intent){
    String id=intent.getStringExtra("case");
    web.loadUrl(origin+(id!=null && id.matches("[a-fA-F0-9-]{36}")?"/asegurado/siniestros/"+id:"/login"));
  } @Override protected void onNewIntent(Intent intent){
    super.onNewIntent(intent);
    openCase(intent);
  } private void configure(){
    EditText input=new EditText(this);
    input.setSingleLine(true);
    input.setHint("192.168.1.20:3000");
    input.setText(origin.replace("http://",""));
    new AlertDialog.Builder(this).setTitle("Servidor en tu Wi-Fi").setMessage("Escribe la IP y puerto del equipo donde ejecutas AutoDamage.").setView(input).setPositiveButton("Conectar",(d,w)->{
      String text=input.getText().toString().trim();if(!text.startsWith("http://"))text="http://"+text; Uri uri=Uri.parse(text);String host=uri.getHost();boolean local=false; if(host!=null && host.matches("[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+")){
        String[] parts=host.split("\\.");int[] ip=new int[4];boolean valid=true;for(int i=0;i<4;i++){
          try{
            ip[i]=Integer.parseInt(parts[i]);if(ip[i]>255)valid=false;
          } catch(Exception e){
            valid=false;
          }
        } local=valid && (ip[0]==10 || ip[0]==127 || (ip[0]==192 && ip[1]==168) || (ip[0]==172 && ip[1]>=16 && ip[1]<=31));
      } if(!local || uri.getUserInfo()!=null || !"http".equals(uri.getScheme()) || uri.getPort()>65535 || uri.getPort()==0){
        Toast.makeText(this,"Usa una dirección IPv4 de la red local.",Toast.LENGTH_LONG).show();configure();return;
      } stopService(new Intent(this,NoticeService.class));receiving=false;notices.setText("Activar avisos"); origin="http://"+host+(uri.getPort()>0?":"+uri.getPort():"");getPreferences(0).edit().putString("server",origin).apply();web.loadUrl(origin+"/login");
    } ).setNegativeButton("Cancelar",null).show();
  } @Override protected void onResume(){
    super.onResume();
    if(notices!=null)notices.setText(NoticeService.running?"Detener avisos":"Activar avisos");
  } private void toggleNotices(){
    if(NoticeService.running){
      stopService(new Intent(this,NoticeService.class));
      receiving=false;
      notices.setText("Activar avisos");
      return;
    } if(!trusted()){
      Toast.makeText(this,"Conecta primero con tu servidor.",Toast.LENGTH_LONG).show();
      return;
    } if(Build.VERSION.SDK_INT>=33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=PackageManager.PERMISSION_GRANTED){
      requestPermissions(new String[]{
        "android.permission.POST_NOTIFICATIONS"
      } ,13);
      return;
    } String cookies=CookieManager.getInstance().getCookie(origin);
    if(cookies==null || !cookies.contains("autodamage_session=")){
      Toast.makeText(this,"Inicia sesión antes de activar los avisos.",Toast.LENGTH_LONG).show();
      return;
    } startForegroundService(new Intent(this,NoticeService.class).putExtra("server",origin));
    receiving=true;
    notices.setText("Detener avisos");
  } public class NativeBridge {
    @JavascriptInterface public void capture(String id){
      handler.post(()->{
        if(!trusted() || !validId(id))return;if(pendingCamera!=null){
          reply(id,null,"CAMARA_OCUPADA");return;
        } pendingCamera=id;if(checkSelfPermission("android.permission.CAMERA")!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{
          "android.permission.CAMERA"
        } ,11);else MainActivity.this.capture();
      } );
    } @JavascriptInterface public void location(String id){
      handler.post(()->{
        if(!trusted() || !validId(id))return;if(pendingLocation!=null){
          reply(id,null,"NO_DISPONIBLE");return;
        } pendingLocation=id;if(checkSelfPermission("android.permission.ACCESS_FINE_LOCATION")!=PackageManager.PERMISSION_GRANTED && checkSelfPermission("android.permission.ACCESS_COARSE_LOCATION")!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{
          "android.permission.ACCESS_FINE_LOCATION","android.permission.ACCESS_COARSE_LOCATION"
        } ,12);else locate();
      } );
    }
  } private boolean validId(String id){
    return id!=null && id.matches("[a-fA-F0-9-]{36}");
  } private void capture(){
    try{
      Uri output=Uri.parse("content://"+getPackageName()+".capture/current.jpg");
      Intent intent=new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT,output).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
      intent.setClipData(ClipData.newRawUri("captura",output));
      startActivityForResult(intent,21);
    } catch(Exception error){
      reply(pendingCamera,null,"SIN_CAMARA");
      pendingCamera=null;
    }
  } @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request!=21)return;
    String id=pendingCamera;
    pendingCamera=null;
    if(id==null)return;
    File file=new File(getCacheDir(),"capture.jpg");
    try{
      if(result!=RESULT_OK){
        reply(id,null,"CANCELADO");
        return;
      } BitmapFactory.Options opts=new BitmapFactory.Options();
      opts.inJustDecodeBounds=true;
      BitmapFactory.decodeFile(file.getPath(),opts);
      opts.inSampleSize=1;
      while(Math.max(opts.outWidth,opts.outHeight)/opts.inSampleSize>1600)opts.inSampleSize*=2;
      opts.inJustDecodeBounds=false;
      Bitmap bitmap=BitmapFactory.decodeFile(file.getPath(),opts);
      if(bitmap==null)throw new IOException();
      int orientation=new ExifInterface(file.getPath()).getAttributeInt(ExifInterface.TAG_ORIENTATION,1);
      Matrix matrix=new Matrix();
      if(orientation==3)matrix.postRotate(180);
      else if(orientation==6)matrix.postRotate(90);
      else if(orientation==8)matrix.postRotate(270);
      if(!matrix.isIdentity()){
        Bitmap rotated=Bitmap.createBitmap(bitmap,0,0,bitmap.getWidth(),bitmap.getHeight(),matrix,true);
        if(rotated!=bitmap){
          bitmap.recycle();
          bitmap=rotated;
        }
      } ByteArrayOutputStream bytes=new ByteArrayOutputStream();
      bitmap.compress(Bitmap.CompressFormat.JPEG,90,bytes);
      bitmap.recycle();
      JSONObject payload=new JSONObject();
      payload.put("jpeg","data:image/jpeg;base64,"+Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP));
      reply(id,payload,null);
    } catch(Exception error){
      reply(id,null,"SIN_CAMARA");
    } finally{
      file.delete();
    }
  } private void locate(){
    try{
      LocationManager manager=(LocationManager)getSystemService(LOCATION_SERVICE);
      String provider=manager.isProviderEnabled(LocationManager.GPS_PROVIDER)?LocationManager.GPS_PROVIDER:LocationManager.NETWORK_PROVIDER;
      locationListener=new LocationListener(){
        public void onLocationChanged(Location location){
          try{
            JSONObject value=new JSONObject();
            value.put("latitud",location.getLatitude());
            value.put("longitud",location.getLongitude());
            value.put("precisionM",location.getAccuracy());
            finishLocation(value,null);
          } catch(Exception error){
            finishLocation(null,"NO_DISPONIBLE");
          }
        }
      } ;
      manager.requestSingleUpdate(provider,locationListener,Looper.getMainLooper());
      locationTimeout=()->finishLocation(null,"TIMEOUT");
      handler.postDelayed(locationTimeout,12000);
    } catch(Exception error){
      finishLocation(null,"NO_DISPONIBLE");
    }
  } private void finishLocation(JSONObject value,String error){
    if(locationTimeout!=null)handler.removeCallbacks(locationTimeout);
    if(locationListener!=null)((LocationManager)getSystemService(LOCATION_SERVICE)).removeUpdates(locationListener);
    locationListener=null;
    String id=pendingLocation;
    pendingLocation=null;
    if(id!=null)reply(id,value,error);
  } @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){
    super.onRequestPermissionsResult(request,permissions,results);
    boolean granted=false;
    for(int result:results)if(result==PackageManager.PERMISSION_GRANTED)granted=true;
    if(request==11){
      if(granted)capture();
      else{
        reply(pendingCamera,null,"SIN_PERMISO");
        pendingCamera=null;
      }
    } else if(request==12){
      if(granted)locate();
      else finishLocation(null,"SIN_PERMISO");
    } else if(request==13 && granted)toggleNotices();
  } private void reply(String id,JSONObject value,String error){
    if(id==null || !trusted())return;
    try{
      JSONObject payload=new JSONObject();
      payload.put("id",id);
      payload.put("data",value);
      payload.put("error",error);
      web.evaluateJavascript("window.dispatchEvent(new CustomEvent('autodamage-native',{detail:"+payload+"}));",null);
    } catch(Exception ignored){
    }
  } @Override public void onBackPressed(){
    if(web.canGoBack())web.goBack();
    else super.onBackPressed();
  } @Override protected void onDestroy(){
    if(pendingLocation!=null)finishLocation(null,"CANCELADO");
    web.removeJavascriptInterface("AutoDamageAndroid");
    web.destroy();
    super.onDestroy();
  }
}
