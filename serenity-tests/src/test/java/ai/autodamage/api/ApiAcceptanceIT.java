package ai.autodamage.api;

import io.cucumber.junit.CucumberOptions;
import net.serenitybdd.cucumber.CucumberWithSerenity;
import org.junit.runner.RunWith;

@RunWith(CucumberWithSerenity.class)
@CucumberOptions(features = "classpath:features", glue = "ai.autodamage.api",
    plugin = {"pretty", "json:target/cucumber-results.json"})
public class ApiAcceptanceIT {}
