package com.digitalid.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.util.Map;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AuthFlowIntegrationTest {
    @LocalServerPort
    private int port;

    @Value("${app.admin.password}")
    private String adminPassword;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void publicVerificationExposesOnlyActiveIdentityFieldsAndQrIsPublic() throws Exception {
        CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        HttpClient authenticatedClient = HttpClient.newBuilder().cookieHandler(cookies).build();
        HttpClient publicClient = HttpClient.newHttpClient();
        String baseUrl = "http://127.0.0.1:" + port + "/api";

        HttpResponse<String> login = authenticatedClient.send(
                loginRequest(baseUrl, adminPassword), BodyHandlers.ofString());
        assertThat(login.statusCode()).isEqualTo(200);

        Map<String, Object> card = Map.ofEntries(
                Map.entry("fullName", "Verification Test Student"),
                Map.entry("idNumber", "VERIFY-TEST-0001"),
                Map.entry("dob", "2004-06-12"),
                Map.entry("department", "Computer Science"),
                Map.entry("course", "BSc IT"),
                Map.entry("year", "2nd Year"),
                Map.entry("semester", "4"),
                Map.entry("email", "private@example.test"),
                Map.entry("phone", "5551234567"),
                Map.entry("bloodGroup", "O+"),
                Map.entry("address", "Private address"),
                Map.entry("photo", "data:image/png;base64,iVBORw0KGgo="),
                Map.entry("status", "Active"));
        HttpResponse<String> created = authenticatedClient.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/cards"))
                        .header("Content-Type", "application/json")
                        .POST(BodyPublishers.ofString(objectMapper.writeValueAsString(card)))
                        .build(),
                BodyHandlers.ofString());
        assertThat(created.statusCode()).isEqualTo(201);
        JsonNode saved = objectMapper.readTree(created.body());
        String token = saved.path("verificationToken").asText();
        assertThat(token).matches("[A-Za-z0-9_-]{43}");
        assertThat(saved.path("verificationUrl").asText())
                .isEqualTo("https://ids.test.example/verify.html?token=" + token);
        String verifyUrl = baseUrl + "/verify/" + token;

        HttpResponse<String> qr = publicClient.send(
                HttpRequest.newBuilder(URI.create(verifyUrl + "/qr.svg")).GET().build(),
                BodyHandlers.ofString());
        assertThat(qr.statusCode()).isEqualTo(200);
        assertThat(qr.headers().firstValue("Content-Type").orElse("")).contains("image/svg+xml");
        assertThat(qr.body()).contains("<svg", "<path");

        HttpResponse<String> activeResult = publicClient.send(
                HttpRequest.newBuilder(URI.create(verifyUrl))
                        .header("Origin", "http://localhost:5500")
                        .GET().build(), BodyHandlers.ofString());
        assertThat(activeResult.statusCode()).isEqualTo(200);
        assertThat(activeResult.headers().firstValue("Access-Control-Allow-Origin").orElse(""))
                .isEqualTo("http://localhost:5500");
        JsonNode active = objectMapper.readTree(activeResult.body());
        assertThat(active.path("verified").asBoolean()).isTrue();
        assertThat(active.path("status").asText()).isEqualTo("Active");
        assertThat(active.path("fullName").asText()).isEqualTo("Verification Test Student");
        assertThat(active.has("email")).isFalse();
        assertThat(active.has("phone")).isFalse();
        assertThat(active.has("dob")).isFalse();
        assertThat(active.has("address")).isFalse();
        assertThat(active.has("bloodGroup")).isFalse();
        assertThat(active.has("categoryDetails")).isFalse();

        Map<String, Object> anotherStudent = Map.of(
                "fullName", "Another Verification Student",
                "idNumber", "VERIFY-TEST-0002");
        HttpResponse<String> secondCreated = authenticatedClient.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/cards"))
                        .header("Content-Type", "application/json")
                        .POST(BodyPublishers.ofString(objectMapper.writeValueAsString(anotherStudent)))
                        .build(),
                BodyHandlers.ofString());
        assertThat(secondCreated.statusCode()).isEqualTo(201);
        assertThat(objectMapper.readTree(secondCreated.body()).path("verificationToken").asText())
                .isNotEqualTo(token);

        HttpResponse<String> unknown = publicClient.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/verify/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"))
                        .GET().build(), BodyHandlers.ofString());
        assertThat(unknown.statusCode()).isEqualTo(404);
        assertThat(objectMapper.readTree(unknown.body()).path("verified").asBoolean()).isFalse();
        HttpResponse<String> unknownQr = publicClient.send(
                HttpRequest.newBuilder(URI.create(baseUrl
                        + "/verify/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/qr.svg"))
                        .GET().build(), BodyHandlers.ofString());
        assertThat(unknownQr.statusCode()).isEqualTo(404);

        HttpResponse<String> revoked = authenticatedClient.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/cards/" + saved.path("id").asLong() + "/status"))
                        .header("Content-Type", "application/json")
                        .method("PATCH", BodyPublishers.ofString("{\"status\":\"Inactive\"}"))
                        .build(),
                BodyHandlers.ofString());
        assertThat(revoked.statusCode()).isEqualTo(200);

        HttpResponse<String> inactiveResult = publicClient.send(
                HttpRequest.newBuilder(URI.create(verifyUrl)).GET().build(), BodyHandlers.ofString());
        JsonNode inactive = objectMapper.readTree(inactiveResult.body());
        assertThat(inactive.path("verified").asBoolean()).isFalse();
        assertThat(inactive.path("status").asText()).isEqualTo("Inactive");
        assertThat(inactive.has("fullName")).isFalse();
        assertThat(inactive.has("email")).isFalse();
    }

    @Test
    void changingStudentCardToAnotherCategoryInvalidatesItsVerificationToken() throws Exception {
        CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        HttpClient authenticatedClient = HttpClient.newBuilder().cookieHandler(cookies).build();
        HttpClient publicClient = HttpClient.newHttpClient();
        String baseUrl = "http://127.0.0.1:" + port + "/api";
        assertThat(authenticatedClient.send(loginRequest(baseUrl, adminPassword), BodyHandlers.ofString())
                .statusCode()).isEqualTo(200);

        Map<String, Object> student = Map.of(
                "fullName", "Category Transition Student",
                "idNumber", "VERIFY-TRANSITION-0001");
        HttpResponse<String> created = authenticatedClient.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/cards"))
                        .header("Content-Type", "application/json")
                        .POST(BodyPublishers.ofString(objectMapper.writeValueAsString(student)))
                        .build(),
                BodyHandlers.ofString());
        JsonNode saved = objectMapper.readTree(created.body());
        String token = saved.path("verificationToken").asText();

        Map<String, Object> employee = Map.of(
                "cardType", "EMPLOYEE",
                "fullName", "Category Transition Student",
                "idNumber", "VERIFY-TRANSITION-0001",
                "categoryDetails", Map.of(
                        "jobTitle", "Designer",
                        "department", "Creative",
                        "organization", "Example Studio",
                        "startDate", "2025-03-01"));
        HttpResponse<String> updated = authenticatedClient.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/cards/" + saved.path("id").asLong()))
                        .header("Content-Type", "application/json")
                        .PUT(BodyPublishers.ofString(objectMapper.writeValueAsString(employee)))
                        .build(),
                BodyHandlers.ofString());
        assertThat(updated.statusCode()).isEqualTo(200);
        assertThat(objectMapper.readTree(updated.body()).path("verificationToken").isNull()).isTrue();

        HttpResponse<String> verification = publicClient.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/verify/" + token)).GET().build(),
                BodyHandlers.ofString());
        assertThat(verification.statusCode()).isEqualTo(404);
        assertThat(objectMapper.readTree(verification.body()).path("verified").asBoolean()).isFalse();

        HttpResponse<String> changedBack = authenticatedClient.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/cards/" + saved.path("id").asLong()))
                        .header("Content-Type", "application/json")
                        .PUT(BodyPublishers.ofString(objectMapper.writeValueAsString(student)))
                        .build(),
                BodyHandlers.ofString());
        assertThat(changedBack.statusCode()).isEqualTo(200);
        String renewedToken = objectMapper.readTree(changedBack.body()).path("verificationToken").asText();
        assertThat(renewedToken).matches("[A-Za-z0-9_-]{43}").isNotEqualTo(token);
    }

    @Test
    void validLoginKeepsSessionAndInvalidCredentialsAreRejected() throws Exception {
        CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        HttpClient client = HttpClient.newBuilder().cookieHandler(cookies).build();
        String baseUrl = "http://127.0.0.1:" + port + "/api";

        HttpResponse<String> invalidLogin = client.send(loginRequest(baseUrl, "wrong-password"), BodyHandlers.ofString());
        assertThat(invalidLogin.statusCode()).isEqualTo(401);
        assertThat(cookies.getCookieStore().getCookies()).isEmpty();

        HttpResponse<String> login = client.send(loginRequest(baseUrl, adminPassword), BodyHandlers.ofString());
        assertThat(login.statusCode()).isEqualTo(200);
        String setCookie = login.headers().firstValue("Set-Cookie").orElseThrow();
        assertThat(setCookie).contains("JSESSIONID=").containsIgnoringCase("Path=/")
                .containsIgnoringCase("HttpOnly").containsIgnoringCase("SameSite=Lax")
                .doesNotContainIgnoringCase("Secure");
        JsonNode loginBody = objectMapper.readTree(login.body());
        assertThat(loginBody.has("id")).isTrue();
        assertThat(loginBody.has("user")).isFalse();

        HttpResponse<String> currentUser = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/auth/me")).GET().build(), BodyHandlers.ofString());
        assertThat(currentUser.statusCode()).isEqualTo(200);
        assertThat(objectMapper.readTree(currentUser.body()).path("username").asText()).isEqualTo("admin");

        HttpResponse<String> protectedCards = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/cards")).GET().build(), BodyHandlers.ofString());
        assertThat(protectedCards.statusCode()).isEqualTo(200);
        assertThat(objectMapper.readTree(protectedCards.body()).path("content").isArray()).isTrue();

        HttpResponse<String> cardStats = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/cards/stats")).GET().build(), BodyHandlers.ofString());
        assertThat(cardStats.statusCode()).isEqualTo(200);
        assertThat(objectMapper.readTree(cardStats.body()).has("total")).isTrue();

        HttpResponse<String> logout = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/auth/logout"))
                        .POST(BodyPublishers.noBody()).build(), BodyHandlers.ofString());
        assertThat(logout.statusCode()).isEqualTo(200);
        HttpResponse<String> expiredSession = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/auth/me")).GET().build(), BodyHandlers.ofString());
        assertThat(expiredSession.statusCode()).isEqualTo(401);
    }

    @Test
    void additionalCardCategoriesArePersistedWithoutStudentQrVerification() throws Exception {
        CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        HttpClient client = HttpClient.newBuilder().cookieHandler(cookies).build();
        String baseUrl = "http://127.0.0.1:" + port + "/api";
        assertThat(client.send(loginRequest(baseUrl, adminPassword), BodyHandlers.ofString()).statusCode()).isEqualTo(200);

        Map<String, Object> employee = Map.of(
                "cardType", "EMPLOYEE",
                "fullName", "Morgan Employee",
                "idNumber", "EMP-TEST-001",
                "email", "private.employee@example.test",
                "phone", "5557654321",
                "categoryDetails", Map.of(
                        "jobTitle", "Designer",
                        "department", "Creative",
                        "organization", "Example Studio",
                        "startDate", "2025-03-01"));
        HttpResponse<String> created = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/cards"))
                        .header("Content-Type", "application/json")
                        .POST(BodyPublishers.ofString(objectMapper.writeValueAsString(employee)))
                        .build(),
                BodyHandlers.ofString());
        assertThat(created.statusCode()).isEqualTo(201);
        JsonNode saved = objectMapper.readTree(created.body());
        assertThat(saved.path("cardType").asText()).isEqualTo("EMPLOYEE");
        assertThat(saved.path("categoryDetails").path("jobTitle").asText()).isEqualTo("Designer");
        assertThat(saved.path("verificationToken").isNull()).isTrue();
        assertThat(saved.path("verificationUrl").isNull()).isTrue();

        HttpResponse<String> verification = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/verify/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"))
                        .GET().build(), BodyHandlers.ofString());
        assertThat(verification.statusCode()).isEqualTo(404);

        Map<String, Object> personal = Map.of(
                "cardType", "PERSONAL",
                "fullName", "Optional Fields Person",
                "idNumber", "PERSONAL-TEST-001");
        HttpResponse<String> personalCreated = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/cards"))
                        .header("Content-Type", "application/json")
                        .POST(BodyPublishers.ofString(objectMapper.writeValueAsString(personal)))
                        .build(),
                BodyHandlers.ofString());
        assertThat(personalCreated.statusCode()).isEqualTo(201);
        JsonNode personalSaved = objectMapper.readTree(personalCreated.body());
        assertThat(personalSaved.path("categoryDetails").isEmpty()).isTrue();
        assertThat(personalSaved.path("email").isNull()).isTrue();
        assertThat(personalSaved.path("phone").isNull()).isTrue();

        List<Map<String, Object>> categoryCards = List.of(
                Map.of("cardType", "MEMBER", "fullName", "Test Member", "idNumber", "MEMBER-TEST-001",
                        "categoryDetails", Map.of("organization", "Example Club", "membershipType", "Standard",
                                "memberSince", "2025-01-01")),
                Map.of("cardType", "EVENT", "fullName", "Test Attendee", "idNumber", "EVENT-TEST-001",
                        "categoryDetails", Map.of("eventName", "Community Day", "role", "Volunteer",
                                "date", "2026-11-01", "venue", "Central Hall")),
                Map.of("cardType", "FREELANCER", "fullName", "Test Freelancer", "idNumber", "FREELANCE-TEST-002",
                        "categoryDetails", Map.of("profession", "Designer", "specialty", "Brand identity",
                                "portfolioUrl", "https://portfolio.example")));
        for (Map<String, Object> categoryCard : categoryCards) {
            HttpResponse<String> categoryCreated = client.send(
                    HttpRequest.newBuilder(URI.create(baseUrl + "/cards"))
                            .header("Content-Type", "application/json")
                            .POST(BodyPublishers.ofString(objectMapper.writeValueAsString(categoryCard)))
                            .build(),
                    BodyHandlers.ofString());
            assertThat(categoryCreated.statusCode()).isEqualTo(201);
            JsonNode categorySaved = objectMapper.readTree(categoryCreated.body());
            assertThat(categorySaved.path("cardType").asText()).isEqualTo(categoryCard.get("cardType"));
            assertThat(categorySaved.path("verificationToken").isNull()).isTrue();
        }

        Map<String, Object> invalidPortfolio = Map.of(
                "cardType", "FREELANCER",
                "fullName", "Invalid Portfolio",
                "idNumber", "FREELANCE-TEST-001",
                "categoryDetails", Map.of(
                        "profession", "Designer",
                        "specialty", "Brand identity",
                        "portfolioUrl", "javascript:alert(1)"));
        HttpResponse<String> invalidUrl = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/cards"))
                        .header("Content-Type", "application/json")
                        .POST(BodyPublishers.ofString(objectMapper.writeValueAsString(invalidPortfolio)))
                        .build(),
                BodyHandlers.ofString());
        assertThat(invalidUrl.statusCode()).isEqualTo(400);
    }

    private HttpRequest loginRequest(String baseUrl, String password) throws Exception {
        String body = objectMapper.writeValueAsString(
                Map.of("identifier", "admin@institute.edu", "password", password));
        return HttpRequest.newBuilder(URI.create(baseUrl + "/auth/login"))
                .header("Content-Type", "application/json")
                .POST(BodyPublishers.ofString(body))
                .build();
    }
}
