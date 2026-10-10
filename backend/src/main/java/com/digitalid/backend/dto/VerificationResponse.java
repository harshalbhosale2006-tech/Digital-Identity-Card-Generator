package com.digitalid.backend.dto;

import com.digitalid.backend.entity.IdCard;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record VerificationResponse(
        boolean verified,
        String status,
        String message,
        String fullName,
        String idNumber,
        String department,
        String course,
        String year,
        String semester,
        String photo) {

    public static VerificationResponse invalid() {
        return new VerificationResponse(false, "Invalid", "This identity code is not valid.", null, null,
                null, null, null, null, null);
    }

    public static VerificationResponse inactive(String status) {
        return new VerificationResponse(false, status, "This identity card is not active.", null, null,
                null, null, null, null, null);
    }

    public static VerificationResponse notOfficiallyVerified() {
        return new VerificationResponse(false, "Not officially verified",
                "This card category is not eligible for public institutional verification.",
                null, null, null, null, null, null, null);
    }

    public static VerificationResponse verified(IdCard card) {
        return new VerificationResponse(true, card.getStatus(), "Identity confirmed.", card.getFullName(),
                card.getIdNumber(), card.getDepartment(), card.getCourse(), card.getYear(),
                card.getSemester(), card.getPhoto());
    }
}
