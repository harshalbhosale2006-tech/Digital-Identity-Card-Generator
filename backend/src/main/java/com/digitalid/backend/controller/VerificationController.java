package com.digitalid.backend.controller;

import com.digitalid.backend.dto.VerificationResponse;
import com.digitalid.backend.service.CardService;
import com.digitalid.backend.service.QrCodeService;
import com.digitalid.backend.service.VerificationUrlService;
import com.google.zxing.WriterException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/verify")
public class VerificationController {
    private final CardService cards;
    private final QrCodeService qrCodes;
    private final VerificationUrlService verificationUrls;

    public VerificationController(
            CardService cards,
            QrCodeService qrCodes,
            VerificationUrlService verificationUrls) {
        this.cards = cards;
        this.qrCodes = qrCodes;
        this.verificationUrls = verificationUrls;
    }

    @GetMapping("/{token}")
    public ResponseEntity<VerificationResponse> verify(@PathVariable String token) {
        VerificationResponse result = cards.verify(token);
        HttpStatus status = "Invalid".equals(result.status()) ? HttpStatus.NOT_FOUND : HttpStatus.OK;
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(result);
    }

    @GetMapping(value = "/{token}/qr.svg", produces = "image/svg+xml")
    public ResponseEntity<String> qrCode(@PathVariable String token) throws WriterException {
        if (!verificationUrls.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .cacheControl(CacheControl.noStore()).build();
        }
        if (!cards.verificationTokenExists(token)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).cacheControl(CacheControl.noStore()).build();
        }
        String url = verificationUrls.forToken(token);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("image/svg+xml"))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
                .body(qrCodes.toSvg(url));
    }
}
