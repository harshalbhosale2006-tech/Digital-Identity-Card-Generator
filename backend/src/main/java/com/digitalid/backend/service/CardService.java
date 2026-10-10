package com.digitalid.backend.service;

import com.digitalid.backend.dto.CardRequest;
import com.digitalid.backend.dto.CardStatsResponse;
import com.digitalid.backend.dto.VerificationResponse;
import com.digitalid.backend.entity.IdCard;
import com.digitalid.backend.exception.ConflictException;
import com.digitalid.backend.exception.NotFoundException;
import com.digitalid.backend.repository.IdCardRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Service
public class CardService {
    private static final Set<String> CARD_TYPES = Set.of(
            "STUDENT", "EMPLOYEE", "PERSONAL", "MEMBER", "EVENT", "FREELANCER");
    private static final Map<String, Set<String>> DETAILS_FIELDS = Map.of(
            "EMPLOYEE", Set.of("jobTitle", "department", "organization", "startDate"),
            "PERSONAL", Set.of("birthDate", "nationality"),
            "MEMBER", Set.of("organization", "membershipType", "memberSince", "memberUntil"),
            "EVENT", Set.of("eventName", "role", "date", "venue"),
            "FREELANCER", Set.of("profession", "specialty", "portfolioUrl"));
    private static final Map<String, Set<String>> REQUIRED_DETAILS = Map.of(
            "EMPLOYEE", Set.of("jobTitle", "department", "organization", "startDate"),
            "PERSONAL", Set.of(),
            "MEMBER", Set.of("organization", "membershipType", "memberSince"),
            "EVENT", Set.of("eventName", "role", "date", "venue"),
            "FREELANCER", Set.of("profession", "specialty"));
    private static final Set<String> DATE_FIELDS = Set.of("startDate", "birthDate", "memberSince", "memberUntil", "date");

    private final IdCardRepository cards;
    private final ObjectMapper objectMapper;
    private final SecureRandom secureRandom = new SecureRandom();

    public CardService(IdCardRepository cards, ObjectMapper objectMapper) {
        this.cards = cards;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Page<IdCard> search(String q, String status, String department, String course, String year,
            String semester, int page, int size, String sortBy, String direction) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        String field = switch (sortBy == null ? "createdAt" : sortBy) {
            case "fullName" -> "fullName";
            case "idNumber" -> "idNumber";
            case "status" -> "status";
            default -> "createdAt";
        };
        Sort sort = "asc".equalsIgnoreCase(direction) ? Sort.by(field).ascending() : Sort.by(field).descending();
        return cards.searchCards(blankToNull(q), blankToNull(status), blankToNull(department), blankToNull(course),
                blankToNull(year), blankToNull(semester), PageRequest.of(safePage, safeSize, sort))
                .map(this::ensureVerificationToken);
    }

    @Transactional
    public IdCard create(CardRequest request) {
        if (cards.existsByIdNumberIgnoreCase(request.getIdNumber().trim())) {
            throw new ConflictException("Identity card number already exists.");
        }
        IdCard card = new IdCard();
        apply(card, request);
        if ("STUDENT".equalsIgnoreCase(card.getCardType())) {
            card.setVerificationToken(newVerificationToken());
        }
        return cards.save(card);
    }

    @Transactional
    public IdCard get(Long id) {
        return ensureVerificationToken(cards.findById(id)
                .orElseThrow(() -> new NotFoundException("Identity card not found.")));
    }

    @Transactional
    public IdCard getByNumber(String number) {
        return ensureVerificationToken(cards.findByIdNumberIgnoreCase(number)
                .orElseThrow(() -> new NotFoundException("Identity card not found.")));
    }

    @Transactional(readOnly = true)
    public VerificationResponse verify(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) {
            return VerificationResponse.invalid();
        }
        IdCard card = cards.findByVerificationToken(token).orElse(null);
        if (card == null) return VerificationResponse.invalid();
        if (!"STUDENT".equalsIgnoreCase(normalizedCardType(card.getCardType()))) {
            return VerificationResponse.invalid();
        }
        if (!"active".equalsIgnoreCase(card.getStatus())) {
            return VerificationResponse.inactive(card.getStatus());
        }
        return VerificationResponse.verified(card);
    }

    @Transactional(readOnly = true)
    public boolean verificationTokenExists(String token) {
        return token != null && token.matches("[A-Za-z0-9_-]{43}")
                && cards.existsByVerificationTokenAndCardTypeIgnoreCase(token, "STUDENT");
    }

    @Transactional
    public IdCard update(Long id, CardRequest request) {
        IdCard card = get(id);
        if (cards.existsByIdNumberIgnoreCaseAndIdNot(request.getIdNumber().trim(), id)) {
            throw new ConflictException("Identity card number already exists.");
        }
        apply(card, request);
        if ("STUDENT".equalsIgnoreCase(card.getCardType())) {
            if (card.getVerificationToken() == null || card.getVerificationToken().isBlank()) {
                card.setVerificationToken(newVerificationToken());
            }
        } else {
            card.setVerificationToken(null);
        }
        return cards.save(card);
    }

    @Transactional
    public IdCard updateStatus(Long id, String status) {
        if (status == null || !Set.of("active", "pending", "inactive", "blocked").contains(status.toLowerCase())) {
            throw new IllegalArgumentException("Status must be Active, Pending, Inactive, or Blocked.");
        }
        IdCard card = get(id);
        card.setStatus(capitalize(status));
        return cards.save(card);
    }

    @Transactional
    public void delete(Long id) {
        if (!cards.existsById(id)) throw new NotFoundException("Identity card not found.");
        cards.deleteById(id);
    }

    @Transactional(readOnly = true)
    public CardStatsResponse stats() {
        return new CardStatsResponse(cards.count(), cards.countByStatusIgnoreCase("Active"),
                cards.countByStatusIgnoreCase("Pending"), cards.countByStatusIgnoreCase("Inactive"),
                cards.countByStatusIgnoreCase("Blocked"));
    }

    private void apply(IdCard card, CardRequest request) {
        String cardType = normalizeRequestedType(request.getCardType());
        Map<String, String> categoryDetails = validateCategoryDetails(cardType, request.getCategoryDetails());

        card.setFullName(request.getFullName().trim());
        card.setIdNumber(request.getIdNumber().trim());
        card.setDob(request.getDob());
        card.setDepartment(trimToNull(request.getDepartment()));
        card.setCourse(trimToNull(request.getCourse()));
        card.setYear(trimToNull(request.getYear()));
        card.setSemester(trimToNull(request.getSemester()));
        card.setEmail(trimToNull(request.getEmail()));
        card.setPhone(trimToNull(request.getPhone()));
        card.setBloodGroup(trimToNull(request.getBloodGroup()));
        card.setAddress(trimToNull(request.getAddress()));
        card.setPhoto(request.getPhoto());
        card.setCardType(cardType);
        if (!"STUDENT".equals(cardType)) {
            card.setVerificationToken(null);
        }
        try {
            card.setCategoryDetails(categoryDetails.isEmpty() ? null : objectMapper.writeValueAsString(categoryDetails));
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("Category details could not be stored.");
        }

        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            String status = request.getStatus().trim();
            if (!Set.of("active", "pending", "inactive", "blocked").contains(status.toLowerCase())) {
                throw new IllegalArgumentException("Status must be Active, Pending, Inactive, or Blocked.");
            }
            card.setStatus(capitalize(status));
        } else if (card.getStatus() == null || card.getStatus().isBlank()) {
            card.setStatus("Active");
        }
    }

    private Map<String, String> validateCategoryDetails(String cardType, Map<String, String> suppliedDetails) {
        if ("STUDENT".equals(cardType)) {
            if (suppliedDetails != null && !suppliedDetails.isEmpty()) {
                throw new IllegalArgumentException("Student cards do not accept category-specific details.");
            }
            return Map.of();
        }

        Set<String> allowed = DETAILS_FIELDS.get(cardType);
        Map<String, String> details = new LinkedHashMap<>();
        if (suppliedDetails != null) {
            for (Map.Entry<String, String> entry : suppliedDetails.entrySet()) {
                if (!allowed.contains(entry.getKey())) {
                    throw new IllegalArgumentException("Unsupported " + cardType.toLowerCase() + " detail: "
                            + entry.getKey());
                }
                String value = blankToNull(entry.getValue());
                if (value != null) {
                    if (value.length() > 200) {
                        throw new IllegalArgumentException("Category detail values must be 200 characters or fewer.");
                    }
                    details.put(entry.getKey(), value);
                }
            }
        }

        for (String required : REQUIRED_DETAILS.get(cardType)) {
            if (!details.containsKey(required)) {
                throw new IllegalArgumentException("The " + required + " field is required for this card category.");
            }
        }
        for (String field : DATE_FIELDS) {
            String value = details.get(field);
            if (value == null) continue;
            try {
                LocalDate.parse(value);
            } catch (DateTimeParseException error) {
                throw new IllegalArgumentException("The " + field + " field must be a valid ISO date (YYYY-MM-DD).");
            }
        }
        if ("FREELANCER".equals(cardType) && details.containsKey("portfolioUrl")) {
            validatePortfolioUrl(details.get("portfolioUrl"));
        }
        if ("MEMBER".equals(cardType) && details.containsKey("memberUntil")
                && details.get("memberUntil").compareTo(details.get("memberSince")) < 0) {
            throw new IllegalArgumentException("Member until must not be earlier than member since.");
        }
        return details;
    }

    private void validatePortfolioUrl(String value) {
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            if (!uri.isAbsolute() || uri.getHost() == null || uri.getUserInfo() != null
                    || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) {
                throw new IllegalArgumentException("Portfolio URL must be a valid HTTP or HTTPS URL.");
            }
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("Portfolio URL must be a valid HTTP or HTTPS URL.");
        }
    }

    private String normalizeRequestedType(String value) {
        String cardType = normalizedCardType(value);
        if (!CARD_TYPES.contains(cardType)) {
            throw new IllegalArgumentException("Unsupported card category.");
        }
        return cardType;
    }

    private String normalizedCardType(String value) {
        return value == null || value.isBlank() ? "STUDENT" : value.trim().toUpperCase();
    }

    private IdCard ensureVerificationToken(IdCard card) {
        if ("STUDENT".equalsIgnoreCase(normalizedCardType(card.getCardType()))
                && (card.getVerificationToken() == null || card.getVerificationToken().isBlank())) {
            card.setVerificationToken(newVerificationToken());
            return cards.save(card);
        }
        return card;
    }

    private String newVerificationToken() {
        byte[] bytes = new byte[32];
        String token;
        do {
            secureRandom.nextBytes(bytes);
            token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        } while (cards.existsByVerificationToken(token));
        return token;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String trimToNull(String value) {
        return blankToNull(value);
    }

    private String capitalize(String value) {
        String normalized = value.toLowerCase();
        return Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
    }
}
