package com.digitalid.backend.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.Map;

@Service
public class QrCodeService {
    private static final int QR_SIZE = 220;

    public BitMatrix encode(String contents) throws WriterException {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
        hints.put(EncodeHintType.MARGIN, 4);
        return new QRCodeWriter().encode(contents, BarcodeFormat.QR_CODE, QR_SIZE, QR_SIZE, hints);
    }

    public String toSvg(String contents) throws WriterException {
        BitMatrix matrix = encode(contents);
        StringBuilder path = new StringBuilder();
        for (int y = 0; y < matrix.getHeight(); y++) {
            for (int x = 0; x < matrix.getWidth();) {
                if (!matrix.get(x, y)) {
                    x++;
                    continue;
                }
                int start = x++;
                while (x < matrix.getWidth() && matrix.get(x, y)) x++;
                path.append('M').append(start).append(' ').append(y).append('h').append(x - start)
                        .append("v1h-").append(x - start).append('z');
            }
        }
        return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + matrix.getWidth()
                + "\" height=\"" + matrix.getHeight() + "\" viewBox=\"0 0 " + matrix.getWidth()
                + " " + matrix.getHeight() + "\" shape-rendering=\"crispEdges\">"
                + "<rect width=\"100%\" height=\"100%\" fill=\"#fff\"/>"
                + "<path d=\"" + path + "\" fill=\"#111214\"/></svg>";
    }
}
