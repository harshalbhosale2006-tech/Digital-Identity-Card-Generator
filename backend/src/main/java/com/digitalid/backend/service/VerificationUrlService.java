package com.digitalid.backend.service;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class VerificationUrlService {
    private final URI baseUri;

    public VerificationUrlService(@Value("${app.verification.base-url:}") String verificationBaseUrl) {
        String configuredUrl = verificationBaseUrl == null ? "" : verificationBaseUrl.trim();
        if (configuredUrl.isEmpty()) {
            baseUri = null;
            return;
        }

        URI parsedUri = URI.create(configuredUrl);
        String scheme = parsedUri.getScheme();
        if (!parsedUri.isAbsolute() || parsedUri.getHost() == null || parsedUri.getUserInfo() != null
                || parsedUri.getFragment() != null || !("http".equalsIgnoreCase(scheme)
                        || "https".equalsIgnoreCase(scheme))) {
            throw new IllegalArgumentException(
                    "VERIFICATION_BASE_URL must be an absolute HTTP(S) URL without credentials or a fragment.");
        }
        baseUri = parsedUri;
    }

    public boolean isConfigured() {
        return baseUri != null;
    }

    public String forToken(String token) {
        if (baseUri == null) {
            return null;
        }
        return UriComponentsBuilder.fromUri(baseUri)
                .replaceQueryParam("token")
                .queryParam("token", token)
                .build()
                .encode()
                .toUriString();
    }
}
