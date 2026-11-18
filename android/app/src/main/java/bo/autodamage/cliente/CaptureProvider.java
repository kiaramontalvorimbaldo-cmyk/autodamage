package bo.autodamage.cliente;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Solo comparte el archivo temporal de una captura mediante un permiso de URI. */
public class CaptureProvider extends ContentProvider {
  public boolean onCreate() {
    return true;
  }

  public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
    if (!"/current.jpg".equals(uri.getPath())) throw new FileNotFoundException();
    return ParcelFileDescriptor.open(
        new File(getContext().getCacheDir(), "capture.jpg"),
        ParcelFileDescriptor.parseMode(mode));
  }

  public String getType(Uri uri) {
    if (!"/current.jpg".equals(uri.getPath())) throw new IllegalArgumentException();
    return "image/jpeg";
  }

  public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
    if (!"/current.jpg".equals(uri.getPath())) return null;
    String[] columns = projection == null
        ? new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}
        : projection;
    Object[] values = new Object[columns.length];
    File file = new File(getContext().getCacheDir(), "capture.jpg");
    for (int i = 0; i < columns.length; i++) {
      if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) values[i] = "capture.jpg";
      if (OpenableColumns.SIZE.equals(columns[i])) values[i] = file.length();
    }
    MatrixCursor cursor = new MatrixCursor(columns, 1);
    cursor.addRow(values);
    return cursor;
  }

  public Uri insert(Uri uri, ContentValues values) {
    throw new UnsupportedOperationException();
  }

  public int update(Uri uri, ContentValues values, String selection, String[] args) {
    throw new UnsupportedOperationException();
  }

  public int delete(Uri uri, String selection, String[] args) {
    return 0;
  }
}
