package com.digitalid.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "identity_cards", indexes = {
        @Index(name = "idx_card_full_name", columnList = "full_name"),
        @Index(name = "idx_card_department", columnList = "department"),
        @Index(name = "idx_card_status", columnList = "status")
})
public class IdCard {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "full_name", nullable = false, length = 120) private String fullName;
    @Column(name = "id_number", nullable = false, unique = true, length = 60) private String idNumber;
    @Column(name = "dob") private LocalDate dob;
    @Column(length = 120) private String department;
    @Column(length = 120) private String course;
    @Column(name = "academic_year", length = 40) private String year;
    @Column(length = 40) private String semester;
    @Column(length = 160) private String email;
    @Column(length = 30) private String phone;
    @Column(name = "blood_group", length = 8) private String bloodGroup;
    @Column(length = 1000) private String address;
    @Lob @Column(columnDefinition = "LONGTEXT") private String photo;
    @Column(nullable = false, length = 20) private String status = "Active";
    @Column(name = "verification_token", unique = true, length = 64) private String verificationToken;
    @Column(name = "card_type", columnDefinition = "varchar(32) not null default 'STUDENT'") private String cardType = "STUDENT";
    @Lob @Column(name = "category_details", columnDefinition = "LONGTEXT") private String categoryDetails;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private LocalDateTime updatedAt;
    @PrePersist protected void onCreate() { LocalDateTime now = LocalDateTime.now(); createdAt = now; updatedAt = now; if (status == null || status.isBlank()) status = "Active"; }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }
    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public void setFullName(String v) { fullName = v; }
    public String getIdNumber() { return idNumber; }
    public void setIdNumber(String v) { idNumber = v; }
    public LocalDate getDob() { return dob; }
    public void setDob(LocalDate v) { dob = v; }
    public String getDepartment() { return department; }
    public void setDepartment(String v) { department = v; }
    public String getCourse() { return course; }
    public void setCourse(String v) { course = v; }
    public String getYear() { return year; }
    public void setYear(String v) { year = v; }
    public String getSemester() { return semester; }
    public void setSemester(String v) { semester = v; }
    public String getEmail() { return email; }
    public void setEmail(String v) { email = v; }
    public String getPhone() { return phone; }
    public void setPhone(String v) { phone = v; }
    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String v) { bloodGroup = v; }
    public String getAddress() { return address; }
    public void setAddress(String v) { address = v; }
    public String getPhoto() { return photo; }
    public void setPhoto(String v) { photo = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { status = v; }
    public String getVerificationToken() { return verificationToken; }
    public void setVerificationToken(String v) { verificationToken = v; }
    public String getCardType() { return cardType; }
    public void setCardType(String v) { cardType = v; }
    public String getCategoryDetails() { return categoryDetails; }
    public void setCategoryDetails(String v) { categoryDetails = v; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
