package ai.autodamage.api;

import io.cucumber.java.es.Cuando;
import io.cucumber.java.es.Dado;
import io.cucumber.java.es.Entonces;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;
import java.net.URI;
import net.serenitybdd.rest.SerenityRest;
import static org.hamcrest.Matchers.*;

/** Pruebas HTTP contra Next.js local, con dependencia Supabase simulada y sin WebDriver. */
public class ApiSteps {
    private Response response;

    private static String localUrl(String property) {
        String value = System.getProperty(property, "");
        URI uri = URI.create(value);
        if (!"http".equals(uri.getScheme()) || !"127.0.0.1".equals(uri.getHost()) || uri.getPort() < 1
                || uri.getUserInfo() != null || !uri.getPath().isEmpty() || uri.getQuery() != null) {
            throw new IllegalArgumentException("Solo se permiten servicios de prueba HTTP en 127.0.0.1");
        }
        return value;
    }

    @Dado("que la dependencia de datos está {word}")
    public void dataMode(String mode) {
        if (!mode.equals("disponible") && !mode.equals("indisponible")) throw new IllegalArgumentException("Modo no válido");
        SerenityRest.given().baseUri(localUrl("autodamage.fixtureUrl"))
            .post("/modo/" + mode).then().statusCode(204);
    }

    private void request(String method, String path, String body) {
        if (!path.startsWith("/api/") || path.contains("..") || path.contains(":") || path.contains("\\")) {
            throw new IllegalArgumentException("Solo rutas de API locales");
        }
        RequestSpecification spec = SerenityRest.given().baseUri(localUrl("autodamage.baseUrl"))
            .redirects().follow(false).accept("application/json").contentType("application/json");
        if (body != null) spec.body(body);
        response = spec.request(method, path);
    }

    @Cuando("envío {word} a {string} sin sesión")
    public void withoutSession(String method, String path) { request(method, path, null); }

    @Cuando("envío POST a {string} con este contenido")
    public void withBody(String path, String body) { request("POST", path, body); }

    @Entonces("la API responde con estado {int}")
    public void status(int status) { response.then().statusCode(status); }

    @Entonces("el código de error es {string}")
    public void errorCode(String code) {
        response.then().contentType("application/json").body("error.code", equalTo(code))
            .body("error.message", not(isEmptyOrNullString()));
    }

    @Entonces("el campo {string} es {string}")
    public void field(String field, String value) { response.then().body(field, equalTo(value)); }

    @Entonces("el cierre de sesión es correcto")
    public void logout() { response.then().body("ok", equalTo(true)); }

    @Entonces("la respuesta no permite almacenar el estado de salud")
    public void noCache() { response.then().header("Cache-Control", containsString("no-store")); }

    @Entonces("la respuesta incluye protección contra interpretación de contenido")
    public void securityHeader() { response.then().header("X-Content-Type-Options", equalTo("nosniff")); }
}
