package com.digitalid.backend;

import com.digitalid.backend.service.QrCodeService;
import com.digitalid.backend.service.VerificationUrlService;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.common.BitMatrix;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class QrCodeServiceTest {
    private final QrCodeService qrCodes = new QrCodeService();

    @Test
    void generatedQrCodeCanBeDecodedToItsVerificationUrl() throws Exception {
        String token = "A".repeat(43);
        String verificationUrl = new VerificationUrlService("https://ids.example.edu/verify.html")
                .forToken(token);
        BitMatrix matrix = qrCodes.encode(verificationUrl);
        int[] pixels = new int[matrix.getWidth() * matrix.getHeight()];
        for (int y = 0; y < matrix.getHeight(); y++) {
            for (int x = 0; x < matrix.getWidth(); x++) {
                pixels[y * matrix.getWidth() + x] = matrix.get(x, y) ? 0x000000 : 0xffffff;
            }
        }

        BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(
                new RGBLuminanceSource(matrix.getWidth(), matrix.getHeight(), pixels)));
        String decoded = new MultiFormatReader().decode(bitmap).getText();

        assertThat(decoded).isEqualTo(verificationUrl);
        assertThat(qrCodes.toSvg(verificationUrl)).contains("<svg", "<path");
    }

    @Test
    void unconfiguredVerificationBaseDoesNotInventALocalhostUrl() {
        VerificationUrlService verificationUrls = new VerificationUrlService("");

        assertThat(verificationUrls.isConfigured()).isFalse();
        assertThat(verificationUrls.forToken("token")).isNull();
    }
}
