package com.digitalid.backend.dto;
import com.digitalid.backend.entity.IdCard;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
public record CardResponse(Long id, String fullName, String idNumber, LocalDate dob, String department,
    String course, String year, String semester, String email, String phone, String bloodGroup,
    String address, String photo, String status, LocalDateTime createdAt, LocalDateTime updatedAt,
    String verificationToken, String verificationUrl, String cardType, Map<String, String> categoryDetails) {
    public static CardResponse from(IdCard c, String verificationUrl) {
        return new CardResponse(c.getId(), c.getFullName(), c.getIdNumber(), c.getDob(), c.getDepartment(),
            c.getCourse(), c.getYear(), c.getSemester(), c.getEmail(), c.getPhone(), c.getBloodGroup(),
            c.getAddress(), c.getPhoto(), c.getStatus(), c.getCreatedAt(), c.getUpdatedAt(),
            "STUDENT".equalsIgnoreCase(c.getCardType()) ? c.getVerificationToken() : null,
            "STUDENT".equalsIgnoreCase(c.getCardType()) ? verificationUrl : null,
            c.getCardType(), c.getCategoryDetails() == null || c.getCategoryDetails().isBlank()
                ? Map.of() : readCategoryDetails(c.getCategoryDetails()));
    }

    private static Map<String, String> readCategoryDetails(String json) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json,
                    new com.fasterxml.jackson.core.type.TypeReference<>() {});
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
            throw new IllegalStateException("Stored card category details are invalid.", error);
        }
    }
}
